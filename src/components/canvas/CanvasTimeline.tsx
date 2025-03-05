import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import {
    Play,
    Pause,
    SkipBack,
    Clock,
    MoreHorizontal,
    Eye,
    EyeOff,
    Lock,
    Unlock,
    ZoomIn,
    ZoomOut,
    MoveHorizontal,
    ArrowLeft,
    ArrowRight,
    Volume2,
    VolumeX,
    Scissors
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VideoObject extends fabric.Object {
    mediaElement?: HTMLVideoElement;
    file?: File;
    data?: {
        type: string;
        name: string;
        originalWidth?: number;
        originalHeight?: number;
    };
    id?: string;
}

interface AudioObject extends fabric.Object {
    mediaElement?: HTMLAudioElement;
    file?: File;
    data?: {
        type: string;
        name: string;
    };
    id?: string;
}

interface CanvasTimelineProps {
    canvas: fabric.Canvas | null;
    visible: boolean;
    onToggle: () => void;
}

interface VideoTrack {
    id: string;
    mediaObject: VideoObject;
    name: string;
    duration: number;
    isVisible: boolean;
    isLocked: boolean;
    thumbnails: string[];
    clipStart?: number;
    clipEnd?: number;
}

interface AudioTrack {
    id: string;
    mediaObject: AudioObject;
    name: string;
    duration: number;
    isVisible: boolean;
    isLocked: boolean;
    isMuted: boolean;
    waveform: number[];
    clipStart?: number;
    clipEnd?: number;
}

interface ClipEditor {
    trackId: string;
    trackType: 'video' | 'audio';
    startPosition: number;
    endPosition: number;
}

const CanvasTimeline: React.FC<CanvasTimelineProps> = ({ canvas, visible, onToggle }) => {
    // Constants for playback control
    const NORMAL_PLAYBACK_RATE = 1.0; // 1x speed
    const TARGET_FRAME_RATE = 30; // Target 30fps for smooth motion
    const FIXED_DELTA_TIME = NORMAL_PLAYBACK_RATE / TARGET_FRAME_RATE;

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [videoTracks, setVideoTracks] = useState<VideoTrack[]>([]);
    const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
    const [scale, setScale] = useState(20); // pixels per second
    const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
    const [isGeneratingWaveform, setIsGeneratingWaveform] = useState(false);
    const [viewportWidth, setViewportWidth] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [isAutoScroll, setIsAutoScroll] = useState(true);
    const [activeClipEditor, setActiveClipEditor] = useState<ClipEditor | null>(null);

    const timelineRef = useRef<HTMLDivElement>(null);
    const animationRef = useRef<number | null>(null);
    const lastUpdateTime = useRef<number>(Date.now());
    // Use refs to avoid infinite render loops
    const scrollPositionRef = useRef(0);

    // Add reference to scroll container
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    // Add state for tracking if user is holding shift key
    const [isShiftKeyPressed, setIsShiftKeyPressed] = useState(false);

    // Add this new ref to track last toggle time
    const lastToggleTime = useRef<number | null>(null);

    // Track shift key press/release
    useEffect(() => {
        if (!visible) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftKeyPressed(true);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Shift') {
                setIsShiftKeyPressed(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [visible]);

    // Handle wheel events for intuitive scrolling
    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault(); // Prevent default scrolling

        if (!scrollAreaRef.current) return;

        const scrollContent = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
        if (!scrollContent) return;

        const SCROLL_SPEED = 1.2; // Adjust speed multiplier as needed

        // Get the delta values
        const deltaX = e.deltaX;
        const deltaY = e.deltaY;

        // Determine scroll direction based on shift key or dominant axis
        const isHorizontalScroll = isShiftKeyPressed || Math.abs(deltaX) > Math.abs(deltaY);

        if (isHorizontalScroll) {
            // Horizontal scrolling (through time)
            const scrollAmount = (deltaX !== 0 ? deltaX : deltaY) * SCROLL_SPEED;
            scrollContent.scrollLeft += scrollAmount;

            // Update scroll position for playhead sync
            scrollPositionRef.current = scrollContent.scrollLeft;
            setScrollLeft(scrollContent.scrollLeft);
        } else {
            // Vertical scrolling (through tracks)
            scrollContent.scrollTop += deltaY * SCROLL_SPEED;
        }
    }, [isShiftKeyPressed]);

    // Apply wheel event listener
    useEffect(() => {
        if (!visible || !scrollAreaRef.current) return;

        const scrollArea = scrollAreaRef.current;

        // Add passive: false to override default scroll behavior
        scrollArea.addEventListener('wheel', handleWheel as EventListener, { passive: false });

        return () => {
            scrollArea.removeEventListener('wheel', handleWheel as EventListener);
        };
    }, [visible, handleWheel]);

    // Update viewport dimensions
    useEffect(() => {
        if (!visible) return;

        const updateViewportSize = () => {
            if (scrollAreaRef.current) {
                setViewportWidth(scrollAreaRef.current.clientWidth);
                setViewportHeight(scrollAreaRef.current.clientHeight);
            }
        };

        // Initial size update
        updateViewportSize();

        // Add resize listener
        window.addEventListener('resize', updateViewportSize);

        return () => {
            window.removeEventListener('resize', updateViewportSize);
        };
    }, [visible]);

    // Find all media objects on the canvas and update tracks
    useEffect(() => {
        if (!canvas || !visible) return;

        const updateMediaObjects = () => {
            if (!canvas) return;

            const objects = canvas.getObjects();

            // Find video objects
            const videoObjects = objects.filter(obj => {
                const mediaObj = obj as VideoObject;
                return mediaObj.mediaElement && mediaObj.mediaElement instanceof HTMLVideoElement;
            }) as VideoObject[];

            // Find audio objects
            const audioObjects = objects.filter(obj => {
                const mediaObj = obj as any;
                // Audio objects are now invisible on canvas but still have media elements
                // They are positioned off-canvas but still tracked in the timeline
                return mediaObj.mediaElement && mediaObj.mediaElement instanceof HTMLAudioElement;
            }) as AudioObject[];

            // Update existing video tracks and add new ones
            setVideoTracks(prevTracks => {
                const newTracks: VideoTrack[] = [];
                let maxDuration = 0;

                videoObjects.forEach(videoObj => {
                    if (!videoObj.mediaElement) return;

                    const videoElement = videoObj.mediaElement;
                    // Use object ID instead of object reference for more reliable tracking
                    const existingTrack = prevTracks.find(t =>
                        // Check if objects have same ID or if they are the same reference
                        (videoObj.id && t.mediaObject.id === videoObj.id) || t.mediaObject === videoObj
                    );
                    const videoDuration = isNaN(videoElement.duration) ? 0 : videoElement.duration;

                    if (existingTrack) {
                        // Update existing track
                        newTracks.push({
                            ...existingTrack,
                            duration: videoDuration,
                            mediaObject: videoObj // Update with latest reference
                        });
                    } else {
                        // Create a new track
                        const trackName = videoObj.data?.name || 'Unnamed Video';
                        newTracks.push({
                            id: `video-track-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                            mediaObject: videoObj,
                            name: trackName,
                            duration: videoDuration,
                            isVisible: true,
                            isLocked: false,
                            thumbnails: [],
                            clipStart: undefined,
                            clipEnd: undefined
                        });
                    }

                    maxDuration = Math.max(maxDuration, videoDuration);
                });

                return newTracks;
            });

            // Update existing audio tracks and add new ones
            setAudioTracks(prevTracks => {
                const newTracks: AudioTrack[] = [];
                let maxDuration = 0;

                audioObjects.forEach(audioObj => {
                    if (!audioObj.mediaElement) return;

                    const audioElement = audioObj.mediaElement;
                    // Use object ID instead of object reference for more reliable tracking
                    const existingTrack = prevTracks.find(t =>
                        // Check if objects have same ID or if they are the same reference
                        (audioObj.id && t.mediaObject.id === audioObj.id) || t.mediaObject === audioObj
                    );
                    const audioDuration = isNaN(audioElement.duration) ? 0 : audioElement.duration;

                    if (existingTrack) {
                        // Update existing track
                        newTracks.push({
                            ...existingTrack,
                            duration: audioDuration,
                            mediaObject: audioObj // Update with latest reference
                        });
                    } else {
                        // Create a new track
                        const trackName = audioObj.data?.name || 'Unnamed Audio';
                        newTracks.push({
                            id: `audio-track-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                            mediaObject: audioObj,
                            name: trackName,
                            duration: audioDuration,
                            isVisible: true,
                            isLocked: false,
                            isMuted: false,
                            waveform: [],
                            clipStart: undefined,
                            clipEnd: undefined
                        });
                    }

                    maxDuration = Math.max(maxDuration, audioDuration);
                });

                return newTracks;
            });

            // Update total duration based on the longest media
            const allTracks = [...videoTracks, ...audioTracks];
            if (allTracks.length > 0) {
                const maxDuration = Math.max(...allTracks.map(track => track.duration));
                if (maxDuration > 0) {
                    setDuration(maxDuration);
                }
            }
        };

        // Generate thumbnails and waveforms for tracks that don't have them
        const generateMediaVisualization = async () => {
            // Generate thumbnails for video tracks
            setVideoTracks(prevTracks => {
                return prevTracks.map(track => {
                    if (track.thumbnails.length === 0 && track.duration > 0) {
                        // Schedule thumbnail generation
                        setTimeout(() => {
                            generateVideoThumbnails(track);
                        }, 500);
                    }
                    return track;
                });
            });

            // Generate waveforms for audio tracks
            setAudioTracks(prevTracks => {
                return prevTracks.map(track => {
                    if (track.waveform.length === 0 && track.duration > 0) {
                        // Schedule waveform generation
                        setTimeout(() => {
                            generateAudioWaveform(track);
                        }, 500);
                    }
                    return track;
                });
            });
        };

        // Initial update
        updateMediaObjects();
        generateMediaVisualization();

        // Listen for objects added to canvas
        const handleObjectAdded = (e: any) => {
            const addedObject = e.target as any;
            if (addedObject.mediaElement instanceof HTMLVideoElement ||
                addedObject.mediaElement instanceof HTMLAudioElement) {
                console.log('Media added to canvas:', addedObject);
                updateMediaObjects();
                // Delay media visualization generation slightly to ensure media is ready
                setTimeout(() => {
                    generateMediaVisualization();
                }, 800);
            }
        };

        const handleObjectRemoved = (e: any) => {
            const removedObject = e.target as any;
            if (removedObject.mediaElement instanceof HTMLVideoElement) {
                setVideoTracks(prevTracks =>
                    prevTracks.filter(track => track.mediaObject !== removedObject)
                );
            } else if (removedObject.mediaElement instanceof HTMLAudioElement) {
                setAudioTracks(prevTracks =>
                    prevTracks.filter(track => track.mediaObject !== removedObject)
                );
            }
        };

        canvas.on('object:added', handleObjectAdded);
        canvas.on('object:removed', handleObjectRemoved);

        return () => {
            canvas.off('object:added', handleObjectAdded);
            canvas.off('object:removed', handleObjectRemoved);
        };
    }, [canvas, visible, videoTracks, audioTracks]);

    // Generate thumbnails for a video track
    const generateVideoThumbnails = async (track: VideoTrack) => {
        if (!track.mediaObject.mediaElement) return;

        // Local variable to prevent multiple simultaneous thumbnail generation
        const localGenerating = isGeneratingThumbnails;
        if (localGenerating) {
            // If already generating thumbnails, schedule this for later
            setTimeout(() => generateVideoThumbnails(track), 1000);
            return;
        }

        setIsGeneratingThumbnails(true);

        try {
            const video = track.mediaObject.mediaElement;
            const numThumbnails = Math.max(5, Math.ceil(track.duration / 2)); // One thumbnail every ~2 seconds
            const thumbnails: string[] = [];

            // Create an offscreen canvas for thumbnail generation
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Could not get canvas context');
            }

            canvas.width = 160;
            canvas.height = 90;

            // Store original current time to restore later
            const originalTime = video.currentTime;

            // Generate thumbnails at even intervals
            for (let i = 0; i < numThumbnails; i++) {
                const timePoint = (i / (numThumbnails - 1)) * track.duration;

                // Seek to time point
                video.currentTime = timePoint;

                // Wait for video to seek
                await new Promise<void>((resolve, reject) => {
                    const onSeeked = () => {
                        video.removeEventListener('seeked', onSeeked);
                        video.removeEventListener('error', onError);
                        resolve();
                    };

                    const onError = (e: Event) => {
                        video.removeEventListener('seeked', onSeeked);
                        video.removeEventListener('error', onError);
                        reject(new Error('Video seek error'));
                    };

                    const timeoutId = setTimeout(() => {
                        video.removeEventListener('seeked', onSeeked);
                        video.removeEventListener('error', onError);
                        // Just continue if we time out on a frame
                        resolve();
                    }, 500); // 500ms timeout

                    video.addEventListener('seeked', onSeeked);
                    video.addEventListener('error', onError);
                });

                // Draw video frame to canvas
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Convert to data URL
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                thumbnails.push(dataUrl);
            }

            // Update track with thumbnails
            setVideoTracks(prevTracks =>
                prevTracks.map(t =>
                    t.id === track.id ? { ...t, thumbnails } : t
                )
            );

            // Reset video state
            video.currentTime = originalTime;
        } catch (error) {
            console.error('Error generating thumbnails:', error);
        } finally {
            setIsGeneratingThumbnails(false);
        }
    };

    // Create a shared AudioContext reference outside function to limit creations
    let sharedAudioContext: AudioContext | null = null;
    const createOrReuseAudioContext = (sampleRate?: number): AudioContext | null => {
        // If we already have a valid context, try to reuse it
        if (sharedAudioContext && sharedAudioContext.state !== 'closed') {
            try {
                // Check if it's usable
                if (sharedAudioContext.state === 'running' || sharedAudioContext.state === 'suspended') {
                    return sharedAudioContext;
                }
            } catch (e) {
                // Context might be in a bad state, create a new one
                try {
                    sharedAudioContext.close();
                } catch (closeErr) {
                    // Ignore close errors
                }
                sharedAudioContext = null;
            }
        }

        // Create a new context
        try {
            const AudioContextClass = window.AudioContext ||
                (window as any).webkitAudioContext ||
                (window as any).mozAudioContext;

            if (!AudioContextClass) return null;

            // Try with options first
            if (sampleRate) {
                try {
                    sharedAudioContext = new AudioContextClass({
                        latencyHint: 'playback',
                        sampleRate: sampleRate
                    });
                    return sharedAudioContext;
                } catch (e) {
                    // Fall back to default constructor
                }
            }

            // Create without options
            sharedAudioContext = new AudioContextClass();
            return sharedAudioContext;
        } catch (e) {
            console.warn("Could not create AudioContext:", e);
            return null;
        }
    };

    // Safely close the shared context when needed
    const safelyCloseAudioContext = async () => {
        if (sharedAudioContext) {
            try {
                await sharedAudioContext.close().catch(() => { });
                sharedAudioContext = null;
            } catch (e) {
                // Ignore errors, just null the reference
                sharedAudioContext = null;
            }
        }
    };

    // Reset the audio processing system in case of persistent errors
    const resetAudioSystem = async () => {
        await safelyCloseAudioContext();

        // Delay before next operation to let browser recover
        await new Promise(resolve => setTimeout(resolve, 500));
    };

    // Add this before generateAudioWaveform function
    const generateSimpleWaveform = (audioBuffer: AudioBuffer): number[] => {
        try {
            if (!audioBuffer || audioBuffer.length === 0) {
                return Array(100).fill(0.3);
            }

            const channelData = audioBuffer.getChannelData(0);
            if (!channelData || channelData.length === 0) {
                return Array(100).fill(0.3);
            }

            const dataPoints = 100;
            const blockSize = Math.floor(channelData.length / dataPoints);
            const waveformData: number[] = [];

            for (let i = 0; i < dataPoints; i++) {
                const blockStart = i * blockSize;
                let peak = 0;

                // Find the peak amplitude in this block
                for (let j = 0; j < blockSize && blockStart + j < channelData.length; j++) {
                    peak = Math.max(peak, Math.abs(channelData[blockStart + j]));
                }

                waveformData.push(peak);
            }

            // Normalize between 0.2 and 1
            const maxAmplitude = Math.max(...waveformData, 0.01);
            return waveformData.map(point => 0.2 + (point / maxAmplitude) * 0.8);
        } catch (error) {
            console.warn("Error processing waveform data:", error);
            return Array(100).fill(0.3);
        }
    };

    // Improve audio waveform generation with better error handling
    const generateAudioWaveform = async (track: AudioTrack) => {
        if (!track.mediaObject.file) {
            console.warn("Audio file not found");
            return fallbackWaveform(track);
        }

        const retryKey = `waveform-retry-${track.id}`;
        if (sessionStorage.getItem(retryKey)) {
            console.info("Using fallback for retry attempt");
            return fallbackWaveform(track);
        }

        sessionStorage.setItem(retryKey, 'true');
        const tempWaveform = Array(100).fill(0.3);
        setAudioTracks(prevTracks =>
            prevTracks.map(t => t.id === track.id ? { ...t, waveform: tempWaveform } : t)
        );

        try {
            const fileData = await track.mediaObject.file.arrayBuffer();
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(fileData);

            if (!audioBuffer || audioBuffer.length === 0) {
                throw new Error("Invalid audio buffer");
            }

            const waveform = generateSimpleWaveform(audioBuffer);
            await audioContext.close();
            sessionStorage.removeItem(retryKey);

            setAudioTracks(prevTracks =>
                prevTracks.map(t => t.id === track.id ? { ...t, waveform } : t)
            );

            return waveform;
        } catch (error) {
            console.warn("Error generating waveform:", error);
            return fallbackWaveform(track);
        }
    };

    // Helper function to update track waveform
    const updateTrackWaveform = (trackId: string, waveform: number[]) => {
        setAudioTracks(prevTracks =>
            prevTracks.map(t =>
                t.id === trackId
                    ? { ...t, waveform }
                    : t
            )
        );
    };

    // Provide a more visually appealing fallback waveform
    const fallbackWaveform = (track: AudioTrack): number[] => {
        console.info("Generating fallback waveform for:", track.name);

        // Generate a more natural-looking waveform pattern
        const dataPoints = 100;
        const waveform = Array(dataPoints).fill(0).map((_, index) => {
            // Create a composite wave pattern
            const position = index / dataPoints;
            const mainWave = Math.sin(position * Math.PI * 4);
            const secondaryWave = Math.sin(position * Math.PI * 8) * 0.5;
            const randomness = Math.random() * 0.1;

            // Combine waves and normalize between 0.2 and 0.8
            return 0.2 + (Math.abs(mainWave + secondaryWave) * 0.5 + randomness) * 0.6;
        });

        // Update track with the fallback waveform
        updateTrackWaveform(track.id, waveform);
        return waveform;
    };

    // Add this new function near the top of the component
    const requestVideoFrameCallback = (video: HTMLVideoElement, callback: () => void) => {
        if ('requestVideoFrameCallback' in video) {
            // Use native video frame callback if available
            (video as any).requestVideoFrameCallback(callback);
        } else {
            // Fallback to requestAnimationFrame
            requestAnimationFrame(callback);
        }
    };

    // Fix the isTimeWithinClip function to correctly handle clip boundaries
    const isTimeWithinClip = (time: number, clipStart?: number, clipEnd?: number): boolean => {
        // Add a small tolerance for floating point comparisons (0.001 seconds)
        const EPSILON = 0.001;

        // If no clip boundaries, everything is within clip
        if (clipStart === undefined && clipEnd === undefined) return true;

        // Check start boundary with tolerance
        if (clipStart !== undefined && time < clipStart - EPSILON) return false;

        // Check end boundary with tolerance
        if (clipEnd !== undefined && time >= clipEnd + EPSILON) return false;

        // Within boundaries
        return true;
    };

    // Add a new useEffect to monitor external media playback
    useEffect(() => {
        if (!canvas) return;

        // Create a global event listener for video play/pause events
        const handleMediaPlayPause = (e: Event) => {
            const mediaElement = e.target as HTMLMediaElement;

            // Add a check to prevent responding to events we initiated ourselves
            if (mediaElement.hasAttribute('data-timeline-play') ||
                mediaElement.hasAttribute('data-timeline-pause')) {
                return;
            }

            // When a media element starts playing from outside the timeline
            if (e.type === 'play' && !isPlaying) {
                // Check if this is one of our tracked media elements
                const isTrackedMedia = [...videoTracks, ...audioTracks].some(
                    track => track.mediaObject.mediaElement === mediaElement
                );

                if (isTrackedMedia) {
                    console.log("External play detected, syncing timeline");
                    // Start timeline playback to match
                    setIsPlaying(true);
                    lastUpdateTime.current = Date.now();
                }
            }

            // When a media element pauses from outside the timeline
            if (e.type === 'pause' && isPlaying) {
                // Check if this is one of our tracked media elements and not at the end
                const isTrackedMedia = [...videoTracks, ...audioTracks].some(
                    track => track.mediaObject.mediaElement === mediaElement
                );

                if (isTrackedMedia && !mediaElement.ended) {
                    console.log("External pause detected, checking if all media is paused");
                    // Check if all tracked media is now paused
                    const allPaused = [...videoTracks, ...audioTracks].every(
                        track => !track.mediaObject.mediaElement || track.mediaObject.mediaElement.paused
                    );

                    if (allPaused) {
                        console.log("All media is paused, stopping timeline playback");
                        // Stop timeline playback to match
                        setIsPlaying(false);
                        if (animationRef.current) {
                            cancelAnimationFrame(animationRef.current);
                            animationRef.current = null;
                        }
                    }
                }
            }
        };

        // Function to add event listeners to media elements
        const addMediaListeners = () => {
            [...videoTracks, ...audioTracks].forEach(track => {
                const element = track.mediaObject.mediaElement;
                if (element) {
                    element.addEventListener('play', handleMediaPlayPause);
                    element.addEventListener('pause', handleMediaPlayPause);

                    // Also ensure current time syncs with the timeline
                    element.addEventListener('timeupdate', (e) => {
                        if (!isPlaying && isTimeWithinClip(element.currentTime, track.clipStart, track.clipEnd)) {
                            setCurrentTime(element.currentTime);
                        }
                    });
                }
            });
        };

        // Add listeners immediately
        addMediaListeners();

        // Add listeners again whenever tracks change
        return () => {
            // Remove event listeners when component unmounts or tracks change
            [...videoTracks, ...audioTracks].forEach(track => {
                const element = track.mediaObject.mediaElement;
                if (element) {
                    element.removeEventListener('play', handleMediaPlayPause);
                    element.removeEventListener('pause', handleMediaPlayPause);
                    element.removeEventListener('timeupdate', (e) => { });
                }
            });
        };
    }, [canvas, videoTracks, audioTracks, isPlaying]);

    // Update the updatePlayback function to handle media starting at clip points
    useEffect(() => {
        if (!isPlaying) {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            return;
        }

        let isUpdateScheduled = false;

        const updatePlayback = () => {
            if (!isPlaying) return;

            const now = Date.now();
            const deltaTime = (now - lastUpdateTime.current) / 1000;
            lastUpdateTime.current = now;

            let maxCurrentTime = 0;
            let isAnyMediaPlaying = false;
            let allElementsAtEnd = true;

            // Current timeline position
            const currentTimelinePosition = currentTime;

            // Find the earliest clip start among all tracks
            let earliestClipStart = Infinity;
            [...videoTracks, ...audioTracks].forEach(track => {
                if (track.clipStart !== undefined) {
                    earliestClipStart = Math.min(earliestClipStart, track.clipStart);
                }
            });
            if (earliestClipStart === Infinity) earliestClipStart = 0;

            [...videoTracks, ...audioTracks].forEach(track => {
                const element = track.mediaObject.mediaElement;
                if (!element) return;

                const clipStart = track.clipStart;
                const clipEnd = track.clipEnd;

                // Determine if this element should be playing based on the current timeline position
                const shouldPlay = clipStart === undefined ||
                    (currentTimelinePosition >= clipStart &&
                        (clipEnd === undefined || currentTimelinePosition < clipEnd));

                // Check if we're at the clip end
                const isAtClipEnd = clipEnd !== undefined && currentTimelinePosition >= clipEnd;

                // Check if the element still has media to play
                allElementsAtEnd = allElementsAtEnd && (element.ended || isAtClipEnd);

                // Check if the current timeline position has reached this clip's start point
                const timelineReachedClipStart = clipStart !== undefined &&
                    currentTimelinePosition >= clipStart &&
                    (clipEnd === undefined || currentTimelinePosition < clipEnd);

                // Special case: If timeline has reached this clip's start but element isn't playing yet
                if (timelineReachedClipStart && element.paused) {
                    console.log(`Timeline reached clip start for ${track.id}`, {
                        timelinePosition: currentTimelinePosition,
                        clipStart,
                        clipEnd,
                        paused: element.paused,
                        currentTime: element.currentTime
                    });

                    // Set to exact clip start plus a tiny offset
                    element.currentTime = clipStart + 0.001;

                    // Try to play this element since timeline has reached its clip start
                    if (element instanceof HTMLAudioElement && 'isMuted' in track) {
                        element.muted = (track as AudioTrack).isMuted || false;
                    }

                    element.play().catch(error => {
                        console.warn(`Error starting playback at clip start for ${track.id}:`, error);
                    });

                    // Update tracking variables
                    isAnyMediaPlaying = true;
                    maxCurrentTime = Math.max(maxCurrentTime, element.currentTime);
                }
                // Normal playback case - element is already playing and should continue
                else if (shouldPlay) {
                    if (!element.paused && !element.ended) {
                        isAnyMediaPlaying = true;
                        maxCurrentTime = Math.max(maxCurrentTime, element.currentTime);

                        // Ensure audio is not muted for audio tracks
                        if (element instanceof HTMLAudioElement && 'isMuted' in track) {
                            element.muted = (track as AudioTrack).isMuted || false;
                        }
                    } else if (element.paused && timelineReachedClipStart) {
                        // Try to resume playback if it's within clip bounds
                        element.setAttribute('data-timeline-play', 'true');
                        element.play().catch(error => {
                            console.warn("Error resuming playback:", error);
                        }).finally(() => {
                            element.removeAttribute('data-timeline-play');
                        });
                    }
                } else if (isAtClipEnd) {
                    // If at clip end, pause
                    if (!element.paused) {
                        element.setAttribute('data-timeline-pause', 'true');
                        element.pause();
                        element.removeAttribute('data-timeline-pause');
                    }
                }
            });

            // Special case: If no media is playing but we're still in playback mode
            // This can happen if all elements have clip boundaries and we're outside all of them
            if (!isAnyMediaPlaying && !allElementsAtEnd) {
                // Check if the timeline is before the earliest clip start
                if (currentTimelinePosition < earliestClipStart) {
                    // Force a consistent advancement speed (1x real-time)
                    // This ensures normal playback speed regardless of actual frame rate

                    // Advance the timeline toward the earliest clip start at normal playback speed
                    const newTime = Math.min(currentTimelinePosition + FIXED_DELTA_TIME, earliestClipStart);
                    setCurrentTime(newTime);
                    console.log(`No media playing. Advancing timeline toward earliest clip: ${newTime}/${earliestClipStart}`);
                    maxCurrentTime = newTime;
                    isAnyMediaPlaying = true; // Prevent stopping playback
                }
            }

            // Update timeline position based on the furthest playing media element
            if (isAnyMediaPlaying) {
                setCurrentTime(maxCurrentTime);
            }

            // Handle auto-scroll if needed
            if (isAutoScroll && scrollAreaRef.current && isAnyMediaPlaying) {
                const timePosition = maxCurrentTime * scale;
                const bufferZone = viewportWidth * 0.2;
                const currentScrollLeft = scrollPositionRef.current;

                if (timePosition > currentScrollLeft + viewportWidth - bufferZone ||
                    timePosition < currentScrollLeft + bufferZone) {
                    const newScrollLeft = timePosition - (viewportWidth / 2);
                    const scrollContent = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
                    if (scrollContent) {
                        scrollContent.scrollLeft = newScrollLeft;
                        scrollPositionRef.current = newScrollLeft;
                        setScrollLeft(newScrollLeft);
                    }
                }
            }

            // Stop playback if all elements have reached their clip end
            if (allElementsAtEnd || !isAnyMediaPlaying) {
                setIsPlaying(false);
                if (animationRef.current) {
                    cancelAnimationFrame(animationRef.current);
                    animationRef.current = null;
                }
                return;
            }

            // Schedule next update with consistent timing
            if (!isUpdateScheduled) {
                isUpdateScheduled = true;
                animationRef.current = requestAnimationFrame(() => {
                    isUpdateScheduled = false;
                    updatePlayback();
                });
            }
        };

        // Start the update loop
        lastUpdateTime.current = Date.now();

        // Use a consistent interval for animation updates to ensure smooth playback
        const scheduleNextUpdate = () => {
            isUpdateScheduled = false;
            updatePlayback();
        };

        // Schedule first update with proper timing
        animationRef.current = requestAnimationFrame(scheduleNextUpdate);

        // Cleanup
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
        };
    }, [isPlaying, videoTracks, audioTracks, currentTime, duration, isAutoScroll, scale, viewportWidth]);

    // Add seekToTime function
    const seekToTime = useCallback((time: number) => {
        const boundedTime = Math.max(0, Math.min(time, duration));
        setCurrentTime(boundedTime);

        // Update all video tracks
        videoTracks.forEach(track => {
            if (track.mediaObject.mediaElement) {
                track.mediaObject.mediaElement.currentTime = boundedTime;
            }
        });

        // Update all audio tracks
        audioTracks.forEach(track => {
            if (track.mediaObject.mediaElement) {
                track.mediaObject.mediaElement.currentTime = boundedTime;
            }
        });
    }, [videoTracks, audioTracks, duration]);

    // Reset to beginning
    const resetPlayback = () => {
        if (isPlaying) {
            setIsPlaying(false);
        }

        setCurrentTime(0);

        // Reset videos
        videoTracks.forEach(track => {
            if (track.mediaObject.mediaElement) {
                track.mediaObject.mediaElement.pause();
                track.mediaObject.mediaElement.currentTime = 0;
            }
        });

        // Reset audio
        audioTracks.forEach(track => {
            if (track.mediaObject.mediaElement) {
                track.mediaObject.mediaElement.pause();
                track.mediaObject.mediaElement.currentTime = 0;
            }
        });
    };

    // Handle timeline click
    const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!timelineRef.current) return;

        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const currentScrollLeft = scrollPositionRef.current;

        // Convert position to time, considering scroll offset
        const time = (x + currentScrollLeft) / scale;

        seekToTime(time);
    }, [scale, duration]);

    // Zoom in/out functions
    const zoomIn = useCallback(() => {
        setScale(prevScale => Math.min(prevScale * 1.5, 200)); // Max 200px per second
    }, []);

    const zoomOut = useCallback(() => {
        setScale(prevScale => Math.max(prevScale / 1.5, 5)); // Min 5px per second
    }, []);

    // Zoom to fit all content
    const zoomToFit = useCallback(() => {
        if (!scrollAreaRef.current || duration <= 0) return;

        const availableWidth = scrollAreaRef.current.clientWidth - 40; // 40px for padding
        const newScale = Math.max(5, availableWidth / duration);
        setScale(newScale);

        // Reset scroll position
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollLeft = 0;
            scrollPositionRef.current = 0;
            setScrollLeft(0);
        }
    }, [duration]);

    // Navigate left/right
    const navigateLeft = useCallback(() => {
        if (!scrollAreaRef.current) return;
        const currentScrollLeft = scrollPositionRef.current;
        const newScrollLeft = Math.max(0, currentScrollLeft - viewportWidth / 2);
        scrollAreaRef.current.scrollLeft = newScrollLeft;
        scrollPositionRef.current = newScrollLeft;
        setScrollLeft(newScrollLeft);
    }, [viewportWidth]);

    // Toggle audio track mute
    const toggleAudioMute = (trackId: string) => {
        setAudioTracks(prevTracks => {
            return prevTracks.map(track => {
                if (track.id === trackId) {
                    const newMuted = !track.isMuted;

                    // Update the actual audio element
                    if (track.mediaObject.mediaElement) {
                        track.mediaObject.mediaElement.muted = newMuted;
                    }

                    return { ...track, isMuted: newMuted };
                }
                return track;
            });
        });
    };

    // Toggle track visibility
    const toggleTrackVisibility = (trackId: string) => {
        // Check if it's a video track
        const videoTrack = videoTracks.find(t => t.id === trackId);
        if (videoTrack) {
            setVideoTracks(prevTracks => {
                return prevTracks.map(track => {
                    if (track.id === trackId) {
                        const newIsVisible = !track.isVisible;
                        if (track.mediaObject && canvas) {
                            track.mediaObject.visible = newIsVisible;
                            canvas.renderAll();
                        }
                        return { ...track, isVisible: newIsVisible };
                    }
                    return track;
                });
            });
            return;
        }

        // Check if it's an audio track
        const audioTrack = audioTracks.find(t => t.id === trackId);
        if (audioTrack) {
            setAudioTracks(prevTracks => {
                return prevTracks.map(track => {
                    if (track.id === trackId) {
                        const newIsVisible = !track.isVisible;
                        if (track.mediaObject && canvas) {
                            track.mediaObject.visible = newIsVisible;
                            canvas.renderAll();
                        }
                        return { ...track, isVisible: newIsVisible };
                    }
                    return track;
                });
            });
        }
    };

    // Toggle track lock
    const toggleTrackLock = (trackId: string) => {
        // Check if it's a video track
        const videoTrack = videoTracks.find(t => t.id === trackId);
        if (videoTrack) {
            setVideoTracks(prevTracks => {
                return prevTracks.map(track => {
                    if (track.id === trackId) {
                        const newIsLocked = !track.isLocked;
                        if (track.mediaObject && canvas) {
                            track.mediaObject.selectable = !newIsLocked;
                            track.mediaObject.evented = !newIsLocked;
                            canvas.renderAll();
                        }
                        return { ...track, isLocked: newIsLocked };
                    }
                    return track;
                });
            });
            return;
        }

        // Check if it's an audio track
        const audioTrack = audioTracks.find(t => t.id === trackId);
        if (audioTrack) {
            setAudioTracks(prevTracks => {
                return prevTracks.map(track => {
                    if (track.id === trackId) {
                        const newIsLocked = !track.isLocked;
                        if (track.mediaObject && canvas) {
                            track.mediaObject.selectable = !newIsLocked;
                            track.mediaObject.evented = !newIsLocked;
                            canvas.renderAll();
                        }
                        return { ...track, isLocked: newIsLocked };
                    }
                    return track;
                });
            });
        }
    };

    // Format time as MM:SS
    const formatTime = useCallback((seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // Function to open the clip editor for a track
    const openClipEditor = (trackId: string, trackType: 'video' | 'audio') => {
        // Find the track
        const track = trackType === 'video'
            ? videoTracks.find(t => t.id === trackId)
            : audioTracks.find(t => t.id === trackId);

        if (!track) return;

        // Create clip editor with existing clip points or defaults
        setActiveClipEditor({
            trackId,
            trackType,
            startPosition: track.clipStart ?? 0,
            endPosition: track.clipEnd ?? track.duration
        });
    };

    // Function to close clip editor without saving
    const cancelClipping = () => {
        setActiveClipEditor(null);
    };

    // Function to apply clip settings
    const applyClip = () => {
        if (!activeClipEditor) return;

        const { trackId, trackType, startPosition, endPosition } = activeClipEditor;

        if (trackType === 'video') {
            setVideoTracks(prevTracks =>
                prevTracks.map(track =>
                    track.id === trackId
                        ? {
                            ...track,
                            clipStart: startPosition,
                            clipEnd: endPosition
                        }
                        : track
                )
            );

            // Find the media object and update its starting time if needed
            const track = videoTracks.find(t => t.id === trackId);
            if (track?.mediaObject.mediaElement) {
                // Set the current time to the clip start point
                track.mediaObject.mediaElement.currentTime = startPosition;
            }
        } else {
            setAudioTracks(prevTracks =>
                prevTracks.map(track =>
                    track.id === trackId
                        ? {
                            ...track,
                            clipStart: startPosition,
                            clipEnd: endPosition
                        }
                        : track
                )
            );

            // Find the media object and update its starting time if needed
            const track = audioTracks.find(t => t.id === trackId);
            if (track?.mediaObject.mediaElement) {
                // Set the current time to the clip start point
                track.mediaObject.mediaElement.currentTime = startPosition;
            }
        }

        // Close the clip editor
        setActiveClipEditor(null);
    };

    // Function to update clip start or end position
    const updateClipPosition = (type: 'start' | 'end', position: number) => {
        if (!activeClipEditor) return;

        // Find the track to get its duration for bounds checking
        const track = activeClipEditor.trackType === 'video'
            ? videoTracks.find(t => t.id === activeClipEditor.trackId)
            : audioTracks.find(t => t.id === activeClipEditor.trackId);

        if (!track) return;

        const trackDuration = track.duration;

        // Ensure the position is within valid bounds
        const validPosition = Math.max(0, Math.min(position, trackDuration));

        // Update the clip editor state
        setActiveClipEditor(prev => {
            if (!prev) return prev;

            // For start position, ensure it's less than end position
            if (type === 'start') {
                return {
                    ...prev,
                    startPosition: Math.min(validPosition, prev.endPosition - 0.1) // Ensure at least 0.1s clip
                };
            }

            // For end position, ensure it's greater than start position
            return {
                ...prev,
                endPosition: Math.max(validPosition, prev.startPosition + 0.1) // Ensure at least 0.1s clip
            };
        });
    };

    // Update the togglePlayback function to properly synchronize all media elements
    const togglePlayback = async () => {
        // Debounce check
        if (lastToggleTime.current && Date.now() - lastToggleTime.current < 300) {
            console.log("Ignoring rapid toggle request");
            return;
        }
        lastToggleTime.current = Date.now();

        const newIsPlaying = !isPlaying;

        // First pause all media elements if we're stopping playback
        if (!newIsPlaying) {
            // Cancel any existing animation frame
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }

            // Pause all media elements with our tracking attribute
            [...videoTracks, ...audioTracks].forEach(track => {
                if (track.mediaObject.mediaElement && !track.mediaObject.mediaElement.paused) {
                    track.mediaObject.mediaElement.setAttribute('data-timeline-pause', 'true');
                    track.mediaObject.mediaElement.pause();
                    track.mediaObject.mediaElement.removeAttribute('data-timeline-pause');
                }
            });

            setIsPlaying(false);
            return;
        }

        try {
            // Resume AudioContext if needed (required for audio playback)
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }

            // Current time from the timeline
            const syncTime = currentTime;

            // Prepare media elements
            const mediaElements = [...videoTracks, ...audioTracks]
                .map(track => ({
                    element: track.mediaObject.mediaElement,
                    clipStart: track.clipStart,
                    clipEnd: track.clipEnd,
                    id: track.id,
                    type: track.mediaObject.mediaElement instanceof HTMLVideoElement ? 'video' : 'audio'
                }))
                .filter(({ element }) => element) as {
                    element: HTMLMediaElement;
                    clipStart?: number;
                    clipEnd?: number;
                    id: string;
                    type: 'video' | 'audio';
                }[];

            // Find earliest and latest clip points for all media
            let earliestClipStart = Infinity;
            let latestClipEnd = 0;

            // Track if any clip boundaries exist
            let hasAnyClipBoundary = false;

            mediaElements.forEach(({ clipStart, clipEnd }) => {
                if (clipStart !== undefined) {
                    hasAnyClipBoundary = true;
                    earliestClipStart = Math.min(earliestClipStart, clipStart);
                }
                if (clipEnd !== undefined) {
                    hasAnyClipBoundary = true;
                    latestClipEnd = Math.max(latestClipEnd, clipEnd);
                }
            });

            // Default to 0 if no clips defined
            if (earliestClipStart === Infinity) earliestClipStart = 0;

            // Use current timeline position as the target playback time
            // Don't jump to earliest clip start - maintain current timeline position
            let targetPlaybackTime = syncTime;

            // First ensure all media is paused
            await Promise.all(mediaElements.map(async ({ element }) => {
                try {
                    if (!element.paused) {
                        await element.pause();
                    }
                } catch (error) {
                    console.warn("Error pausing media:", error);
                }
            }));

            // Reset or initialize playback for all media elements
            console.log(`Synchronizing all media to current timeline position: ${targetPlaybackTime}`);

            // Special case: If all media has clip boundaries and we're starting from time 0,
            // we need to explicitly check if we should advance the timeline immediately
            const allHaveClipBoundaries = mediaElements.every(({ clipStart }) => clipStart !== undefined);
            const startingAtBeginning = Math.abs(targetPlaybackTime) < 0.001; // Starting near time 0

            if (allHaveClipBoundaries && startingAtBeginning) {
                console.log(`All media has clip boundaries and we're starting from position 0. Setting timeline to ${targetPlaybackTime} but will advance to ${earliestClipStart} during playback.`);
            }

            // Set each media's time based on the timeline position - don't jump to clip start
            mediaElements.forEach(({ element, clipStart, clipEnd, id }) => {
                try {
                    // Set all elements to the current timeline position
                    element.currentTime = targetPlaybackTime;
                    console.log(`${id} - setting to current timeline: ${targetPlaybackTime}`);
                } catch (error) {
                    console.warn(`Error setting time for ${id}:`, error);
                }
            });

            // Update the timeline position
            setCurrentTime(targetPlaybackTime);

            // Set up video frame callbacks for smooth rendering
            const videoElements = mediaElements.filter(({ type, element }) =>
                type === 'video' && element instanceof HTMLVideoElement
            ).map(({ element, clipStart, clipEnd, id }) => ({
                video: element as HTMLVideoElement,
                clipStart,
                clipEnd,
                id
            }));

            videoElements.forEach(({ video, id }) => {
                const updateCanvas = () => {
                    if (canvas && !video.paused && !video.ended) {
                        canvas.renderAll();
                        requestVideoFrameCallback(video, updateCanvas);
                    }
                };

                // Remove any existing listeners to prevent duplicates
                const boundUpdateCanvas = () => requestVideoFrameCallback(video, updateCanvas);
                video.removeEventListener('play', boundUpdateCanvas);
                video.addEventListener('play', boundUpdateCanvas);

                console.log(`Set up frame callbacks for ${id}`);
            });

            // Set playing state before starting playback
            setIsPlaying(true);
            lastUpdateTime.current = Date.now();

            // Start playback for all media elements that should play at the current timeline position
            const playPromises = mediaElements.map(async ({ element, clipStart, clipEnd, id, type }) => {
                try {
                    // Calculate if this element should play now based on timeline position
                    let shouldPlayNow = false;

                    // If no clip boundaries, always play
                    if (clipStart === undefined && clipEnd === undefined) {
                        shouldPlayNow = true;
                    }
                    // If timeline is at or after clip start and before clip end
                    else if (clipStart !== undefined && targetPlaybackTime >= clipStart &&
                        (clipEnd === undefined || targetPlaybackTime < clipEnd)) {
                        shouldPlayNow = true;
                    }

                    if (shouldPlayNow) {
                        // Ensure audio properties are set correctly
                        if (type === 'audio') {
                            element.muted = false;
                            element.volume = 1;
                        }

                        if (element.paused) {
                            // Mark that we're controlling this play action
                            element.setAttribute('data-timeline-play', 'true');

                            console.log(`Starting playback for ${id} at time ${element.currentTime}`, {
                                clipStart,
                                clipEnd,
                                targetPlaybackTime
                            });

                            await element.play().catch(err => {
                                console.warn(`Error playing ${id}:`, err);
                                throw err;
                            });

                            element.removeEventListener('timeupdate', null);

                            // For elements with clip boundaries, monitor and enforce them
                            if (clipStart !== undefined || clipEnd !== undefined) {
                                const clipMonitor = (e: Event) => {
                                    const mediaEl = e.target as HTMLMediaElement;
                                    const currentTime = mediaEl.currentTime;

                                    // Check if outside the clip end boundary
                                    if (clipEnd !== undefined && currentTime >= clipEnd) {
                                        mediaEl.pause();
                                        console.log(`${id} reached clip end, pausing`);
                                        mediaEl.removeEventListener('timeupdate', clipMonitor);
                                    }
                                    // Handle case where the media element somehow went before the clip start
                                    // This is rare but could happen with seeking or other browser behaviors
                                    else if (clipStart !== undefined && currentTime < clipStart) {
                                        mediaEl.currentTime = clipStart + 0.001;
                                        console.log(`${id} went before clip start, adjusting to ${clipStart + 0.001}`);
                                    }
                                };

                                element.addEventListener('timeupdate', clipMonitor);
                            }

                            element.removeAttribute('data-timeline-play');
                        }
                    } else {
                        console.log(`Not playing ${id} yet - outside current timeline position:`, {
                            currentTime: element.currentTime,
                            clipStart,
                            clipEnd,
                            targetPlaybackTime
                        });
                    }
                } catch (error) {
                    console.warn(`Error playing media ${id}:`, error);
                    element.removeAttribute('data-timeline-play');
                }
            });

            await Promise.allSettled(playPromises);

            // Check if NO media elements are playing because they're all outside their clip boundaries
            // This happens when all elements have clip boundaries and the timeline is outside all of them
            const allHaveClips = mediaElements.every(({ clipStart }) => clipStart !== undefined);
            const noElementsPlaying = !mediaElements.some(({ element, clipStart, clipEnd }) =>
                element &&
                !element.paused &&
                isTimeWithinClip(targetPlaybackTime, clipStart, clipEnd)
            );

            // If all elements have clips and none are playing, make sure the timeline will advance
            if (allHaveClips && noElementsPlaying && hasAnyClipBoundary) {
                if (earliestClipStart > targetPlaybackTime) {
                    console.log(`All media elements have clip boundaries and timeline (${targetPlaybackTime}) is before all clips. Will advance to earliest clip start: ${earliestClipStart}`);

                    // Set up last update time to ensure smooth playback rate from the start
                    // This ensures our first frame of animation uses the correct delta time
                    lastUpdateTime.current = Date.now();

                    // Calculate distance to earliest clip and estimate time to reach it
                    const timeToReachClip = earliestClipStart - targetPlaybackTime;
                    console.log(`Timeline will take approximately ${timeToReachClip.toFixed(2)} seconds to reach the first clip`);
                    // Force the updatePlayback function to run one cycle immediately
                    // This will trigger the timeline advancement logic we added there
                    lastUpdateTime.current = Date.now() - 16; // Simulate 16ms elapsed for first frame
                } else {
                    console.log(`All media elements have clip boundaries but timeline (${targetPlaybackTime}) is at or past earliest clip start (${earliestClipStart}). Something else might be wrong.`);
                }
            }

        } catch (error) {
            console.error("Playback error:", error);
            // Stop all playback if there was an error
            [...videoTracks, ...audioTracks].forEach(track => {
                if (track.mediaObject.mediaElement && !track.mediaObject.mediaElement.paused) {
                    track.mediaObject.mediaElement.pause();
                }
            });
            setIsPlaying(false);
        }
    };

    if (!visible) return null;

    // Calculate timeline width based on duration and scale
    const timelineWidth = Math.max(viewportWidth - 20, (duration * scale) + 200); // Add extra space

    return (
        <div className="fixed inset-x-0 bottom-0 h-64 bg-gray-900 border-t border-purple-500/20 z-50 flex flex-col" data-timeline="true">
            {/* Timeline header */}
            <div className="h-12 border-b border-purple-500/20 flex justify-between items-center px-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium flex items-center gap-1">
                        <Clock className="h-4 w-4 opacity-70" />
                        Timeline
                    </h3>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={isPlaying ? "default" : "outline"}
                                    size="icon"
                                    onClick={togglePlayback}
                                >
                                    {isPlaying ? (
                                        <Pause className="h-4 w-4" />
                                    ) : (
                                        <Play className="h-4 w-4" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isPlaying ? 'Pause' : 'Play'}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={resetPlayback}
                                >
                                    <SkipBack className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Reset to Beginning</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <div className="flex items-center gap-1 ml-3">
                        <span className="text-xs text-gray-400">
                            {formatTime(currentTime)}
                        </span>
                        <span className="text-xs text-gray-600">/</span>
                        <span className="text-xs text-gray-400">
                            {formatTime(duration)}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={navigateLeft}
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Scroll Left</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={zoomIn}
                                    disabled={scale >= 200}
                                >
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Zoom In</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={zoomOut}
                                    disabled={scale <= 5}
                                >
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Zoom Out</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={zoomToFit}
                                >
                                    <MoveHorizontal className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Fit Timeline</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={isAutoScroll ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setIsAutoScroll(!isAutoScroll)}
                                    className="text-xs"
                                >
                                    Auto-Scroll
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{isAutoScroll ? 'Disable' : 'Enable'} auto-scrolling during playback</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            <ScrollArea
                className="flex-1 relative"
                style={{ width: '100%', height: '100%' }}
                ref={scrollAreaRef}
            >
                <div className="min-w-full h-full flex flex-col">
                    {/* Timeline ruler */}
                    <div className="h-6 border-b border-purple-500/20 relative">
                        <div className="absolute inset-y-0 left-20 right-0">
                            <div
                                className="h-full flex items-end relative"
                                style={{ width: `${timelineWidth}px` }}
                            >
                                {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute h-full flex flex-col justify-end items-center"
                                        style={{ left: `${i * scale}px` }}
                                    >
                                        <div className="w-px h-3 bg-purple-500/40"></div>
                                        <span className="text-xs text-gray-400">{formatTime(i)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Media tracks area */}
                    <div
                        className="flex-1 relative"
                        style={{ width: `${timelineWidth}px`, minHeight: "100%" }}
                    >
                        {/* Video tracks */}
                        {videoTracks.map(track => (
                            <div key={track.id} className="flex h-20 border-b border-purple-500/20">
                                {/* Track info fixed sidebar */}
                                <div className="w-20 flex-shrink-0 p-2 bg-gray-800 flex flex-col justify-between sticky left-0 z-10">
                                    <div className="truncate text-xs" title={track.name}>
                                        {track.name}
                                    </div>
                                    <div className="flex gap-1">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => toggleTrackVisibility(track.id)}
                                                    >
                                                        {track.isVisible ? (
                                                            <Eye className="h-3 w-3" />
                                                        ) : (
                                                            <EyeOff className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{track.isVisible ? 'Hide' : 'Show'} track</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => toggleTrackLock(track.id)}
                                                    >
                                                        {track.isLocked ? (
                                                            <Lock className="h-3 w-3" />
                                                        ) : (
                                                            <Unlock className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{track.isLocked ? 'Unlock' : 'Lock'} track</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => openClipEditor(track.id, 'video')}
                                                    >
                                                        <Scissors className="h-3 w-3" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Clip video</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>

                                {/* Track timeline */}
                                <div className="flex-1 relative h-full">
                                    {/* Thumbnails */}
                                    <div className="absolute inset-0 flex items-center p-1">
                                        {track.thumbnails.map((thumbnail, i) => {
                                            const position = (i / (track.thumbnails.length - 1 || 1)) * track.duration * scale;
                                            const thumbWidth = Math.max(30, scale * 0.5); // Dynamic thumbnail width based on scale
                                            return (
                                                <div
                                                    key={i}
                                                    className="absolute top-1 bottom-1 overflow-hidden rounded-sm border border-purple-500/30"
                                                    style={{
                                                        left: `${position - (thumbWidth / 2)}px`,
                                                        width: `${thumbWidth}px`,
                                                        // Add opacity to thumbnails outside the clip area
                                                        opacity: track.clipStart !== undefined &&
                                                            ((i / (track.thumbnails.length - 1 || 1)) * track.duration) < track.clipStart ? 0.3 :
                                                            track.clipEnd !== undefined &&
                                                                ((i / (track.thumbnails.length - 1 || 1)) * track.duration) > track.clipEnd ? 0.3 : 1
                                                    }}
                                                >
                                                    <img
                                                        src={thumbnail}
                                                        alt={`Frame ${i}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Clip indicators */}
                                    {track.clipStart !== undefined && (
                                        <div
                                            className="absolute top-0 bottom-0 border-l-2 border-red-500 z-10"
                                            style={{ left: `${track.clipStart * scale}px` }}
                                        >
                                            <div className="w-2 h-2 bg-red-500 rounded-full relative -left-1" />
                                        </div>
                                    )}
                                    {track.clipEnd !== undefined && (
                                        <div
                                            className="absolute top-0 bottom-0 border-l-2 border-red-500 z-10"
                                            style={{ left: `${track.clipEnd * scale}px` }}
                                        >
                                            <div className="w-2 h-2 bg-red-500 rounded-full relative -left-1" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Audio tracks */}
                        {audioTracks.map(track => (
                            <div key={track.id} className="flex h-16 border-b border-purple-500/20">
                                {/* Track info fixed sidebar */}
                                <div className="w-20 flex-shrink-0 p-2 bg-gray-800 flex flex-col justify-between sticky left-0 z-10">
                                    <div className="truncate text-xs" title={track.name}>
                                        {track.name}
                                    </div>
                                    <div className="flex gap-1">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => toggleAudioMute(track.id)}
                                                    >
                                                        {track.isMuted ? (
                                                            <VolumeX className="h-3 w-3" />
                                                        ) : (
                                                            <Volume2 className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{track.isMuted ? 'Unmute' : 'Mute'} track</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => toggleTrackLock(track.id)}
                                                    >
                                                        {track.isLocked ? (
                                                            <Lock className="h-3 w-3" />
                                                        ) : (
                                                            <Unlock className="h-3 w-3" />
                                                        )}
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{track.isLocked ? 'Unlock' : 'Lock'} track</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6"
                                                        onClick={() => openClipEditor(track.id, 'audio')}
                                                    >
                                                        <Scissors className="h-3 w-3" />
                                                    </Button>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Clip audio</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>

                                {/* Track timeline */}
                                <div className="flex-1 relative h-full">
                                    {/* Waveform visualization */}
                                    <div className="absolute inset-0 flex items-center">
                                        {/* Beautiful background for waveform */}
                                        <div
                                            className="absolute h-12 inset-x-0 bg-gradient-to-r from-purple-900/20 via-purple-800/10 to-purple-900/20 rounded-md border border-purple-500/30"
                                            style={{
                                                opacity: track.isMuted ? '0.4' : '1',
                                            }}
                                        />

                                        {/* Render waveform segments */}
                                        {track.waveform.map((amplitude, i) => {
                                            const position = (i / (track.waveform.length - 1 || 1)) * track.duration * scale;
                                            const height = Math.max(2, Math.round(amplitude * 40)); // Scale amplitude to pixel height

                                            return (
                                                <div
                                                    key={i}
                                                    className="absolute bg-purple-500/60"
                                                    style={{
                                                        left: `${position}px`,
                                                        height: `${height}px`,
                                                        width: '2px',
                                                        top: '50%',
                                                        transform: 'translate(-1px, -50%)'
                                                    }}
                                                />
                                            );
                                        })}

                                        {/* Clip indicators */}
                                        {track.clipStart !== undefined && (
                                            <div
                                                className="absolute top-0 bottom-0 border-l-2 border-red-500 z-10"
                                                style={{ left: `${track.clipStart * scale}px` }}
                                            >
                                                <div className="w-2 h-2 bg-red-500 rounded-full relative -left-1" />
                                            </div>
                                        )}
                                        {track.clipEnd !== undefined && (
                                            <div
                                                className="absolute top-0 bottom-0 border-l-2 border-red-500 z-10"
                                                style={{ left: `${track.clipEnd * scale}px` }}
                                            >
                                                <div className="w-2 h-2 bg-red-500 rounded-full relative -left-1" />
                                            </div>
                                        )}

                                        {/* Add stylish track info overlay */}
                                        <div className="absolute left-3 top-1 text-xs text-white/80 font-medium pointer-events-none">
                                            <span className="bg-purple-600/40 px-1.5 py-0.5 rounded-sm backdrop-blur-sm">
                                                {track.name}
                                            </span>
                                        </div>

                                        {/* Duration indicator */}
                                        <div
                                            className="absolute right-3 top-1 text-xs text-white/70 font-medium pointer-events-none"
                                        >
                                            <span className="bg-purple-700/30 px-1.5 py-0.5 rounded-sm backdrop-blur-sm">
                                                {track.duration.toFixed(1)}s
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Playhead/timeline interaction area */}
                    <div
                        ref={timelineRef}
                        className="absolute top-6 bottom-0 left-20 right-0 cursor-pointer"
                        onClick={handleTimelineClick}
                    >
                        {/* Current time indicator */}
                        <div
                            className="absolute top-0 bottom-0 w-px bg-purple-500 z-10"
                            style={{ left: `${currentTime * scale}px` }}
                        >
                            <div className="absolute top-0 w-2 h-12 bg-purple-500 rounded-full -translate-x-1/2"></div>
                        </div>
                    </div>
                </div>

                <ScrollBar orientation="horizontal" className="h-2 opacity-70" />
                <ScrollBar orientation="vertical" className="w-2 opacity-70" />
            </ScrollArea>

            {/* Clip Editor overlay */}
            {activeClipEditor && (
                <div className="absolute inset-0 bg-black/70 z-50 flex flex-col items-center justify-center">
                    <div className="bg-gray-800 rounded-lg border border-blue-500/40 p-4 w-[90%] max-w-3xl">
                        <h3 className="text-lg font-medium mb-4 text-blue-100">Clip Editor</h3>

                        <div className="mb-6 relative">
                            {/* Labels for handles */}
                            <div className="absolute top-0 left-0 w-full flex justify-between z-40 text-xs pointer-events-none">
                                <div style={{
                                    position: 'absolute',
                                    left: `calc(${(activeClipEditor.startPosition / (activeClipEditor.trackType === 'video'
                                        ? videoTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1
                                        : audioTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1)) * 100}% + 10px)`,
                                    top: '5px',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    backgroundColor: 'rgba(37, 99, 235, 0.7)',
                                    padding: '2px 4px',
                                    borderRadius: '2px'
                                }}>
                                    Start
                                </div>
                                <div style={{
                                    position: 'absolute',
                                    left: `calc(${(activeClipEditor.endPosition / (activeClipEditor.trackType === 'video'
                                        ? videoTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1
                                        : audioTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1)) * 100}% - 40px)`,
                                    top: '5px',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    backgroundColor: 'rgba(37, 99, 235, 0.7)',
                                    padding: '2px 4px',
                                    borderRadius: '2px'
                                }}>
                                    End
                                </div>
                            </div>

                            {/* Timeline representation */}
                            <div className="h-20 bg-gray-700 rounded-md relative overflow-hidden border border-blue-400/30">
                                {/* Track preview */}
                                {activeClipEditor.trackType === 'video' && (
                                    <div className="absolute inset-0">
                                        {(() => {
                                            const track = videoTracks.find(t => t.id === activeClipEditor.trackId);
                                            if (!track) return null;

                                            return track.thumbnails.map((thumbnail, i) => {
                                                const position = (i / (track.thumbnails.length - 1 || 1)) * 100;
                                                return (
                                                    <div
                                                        key={i}
                                                        className="absolute top-0 bottom-0"
                                                        style={{
                                                            left: `${position}%`,
                                                            width: `${100 / (track.thumbnails.length || 1)}%`
                                                        }}
                                                    >
                                                        <img
                                                            src={thumbnail}
                                                            alt={`Frame ${i}`}
                                                            className="h-full object-cover"
                                                        />
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}

                                {activeClipEditor.trackType === 'audio' && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        {(() => {
                                            const track = audioTracks.find(t => t.id === activeClipEditor.trackId);
                                            if (!track) return null;

                                            return (
                                                <div className="w-full h-full flex items-center bg-gradient-to-r from-purple-900/30 via-purple-800/20 to-purple-900/30">
                                                    {track.waveform.map((amplitude, i) => {
                                                        const position = (i / (track.waveform.length - 1 || 1)) * 100;
                                                        const height = Math.max(2, Math.round(amplitude * 40));
                                                        return (
                                                            <div
                                                                key={i}
                                                                className="absolute bg-purple-500/60"
                                                                style={{
                                                                    left: `${position}%`,
                                                                    height: `${height}px`,
                                                                    width: '2px',
                                                                    top: '50%',
                                                                    transform: 'translate(-1px, -50%)'
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {/* Clip start handle */}
                                <div
                                    className="absolute top-0 bottom-0 w-6 bg-blue-600 cursor-ew-resize z-30 opacity-90 hover:opacity-100"
                                    style={{
                                        left: `calc(${(activeClipEditor.startPosition / (activeClipEditor.trackType === 'video'
                                            ? videoTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1
                                            : audioTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1)) * 100}%)`,
                                        right: 'auto'
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();

                                        // Get the clip editor container element
                                        const container = e.currentTarget.parentElement;
                                        if (!container) return;

                                        // Get track duration
                                        const trackDuration = activeClipEditor.trackType === 'video'
                                            ? videoTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1
                                            : audioTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1;

                                        // Get initial container bounds
                                        const containerRect = container.getBoundingClientRect();

                                        // Track the drag operation
                                        let isDragging = true;

                                        const handleMouseMove = (moveEvent: MouseEvent) => {
                                            if (!isDragging) return;

                                            moveEvent.preventDefault();
                                            moveEvent.stopPropagation();

                                            // Calculate position relative to container
                                            const x = moveEvent.clientX - containerRect.left;
                                            const percentage = Math.max(0, Math.min(1, x / containerRect.width));

                                            // Update clip position
                                            updateClipPosition('start', percentage * trackDuration);
                                        };

                                        const handleMouseUp = (upEvent: MouseEvent) => {
                                            upEvent.preventDefault();
                                            upEvent.stopPropagation();

                                            // End dragging
                                            isDragging = false;

                                            // Remove event listeners
                                            document.removeEventListener('mousemove', handleMouseMove);
                                            document.removeEventListener('mouseup', handleMouseUp);
                                        };

                                        // Add event listeners
                                        document.addEventListener('mousemove', handleMouseMove);
                                        document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                >
                                    <div className="h-full flex items-center justify-center">
                                        <div className="w-1 h-full bg-white"></div>
                                    </div>
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-10 bg-blue-200 rounded-full"></div>
                                </div>

                                {/* Clip end handle */}
                                <div
                                    className="absolute top-0 bottom-0 w-6 bg-blue-600 cursor-ew-resize z-30 opacity-90 hover:opacity-100"
                                    style={{
                                        left: `calc(${(activeClipEditor.endPosition / (activeClipEditor.trackType === 'video'
                                            ? videoTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1
                                            : audioTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1)) * 100}% - 3px)`,
                                        right: 'auto'
                                    }}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();

                                        // Get the clip editor container element
                                        const container = e.currentTarget.parentElement;
                                        if (!container) return;

                                        // Get track duration
                                        const trackDuration = activeClipEditor.trackType === 'video'
                                            ? videoTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1
                                            : audioTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1;

                                        // Get initial container bounds
                                        const containerRect = container.getBoundingClientRect();

                                        // Track the drag operation
                                        let isDragging = true;

                                        const handleMouseMove = (moveEvent: MouseEvent) => {
                                            if (!isDragging) return;

                                            moveEvent.preventDefault();
                                            moveEvent.stopPropagation();

                                            // Calculate position relative to container
                                            const x = moveEvent.clientX - containerRect.left;
                                            const percentage = Math.max(0, Math.min(1, x / containerRect.width));

                                            // Update clip position
                                            updateClipPosition('end', percentage * trackDuration);
                                        };

                                        const handleMouseUp = (upEvent: MouseEvent) => {
                                            upEvent.preventDefault();
                                            upEvent.stopPropagation();

                                            // End dragging
                                            isDragging = false;

                                            // Remove event listeners
                                            document.removeEventListener('mousemove', handleMouseMove);
                                            document.removeEventListener('mouseup', handleMouseUp);
                                        };

                                        // Add event listeners
                                        document.addEventListener('mousemove', handleMouseMove);
                                        document.addEventListener('mouseup', handleMouseUp);
                                    }}
                                >
                                    <div className="h-full flex items-center justify-center">
                                        <div className="w-1 h-full bg-white"></div>
                                    </div>
                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-2 h-10 bg-blue-200 rounded-full"></div>
                                </div>

                                {/* The selected area */}
                                <div
                                    className="absolute top-0 bottom-0 bg-blue-500/40 border-t-2 border-b-2 border-blue-300"
                                    style={{
                                        left: `${(activeClipEditor.startPosition / (activeClipEditor.trackType === 'video'
                                            ? videoTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1
                                            : audioTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1)) * 100}%`,
                                        width: `${((activeClipEditor.endPosition - activeClipEditor.startPosition) / (activeClipEditor.trackType === 'video'
                                            ? videoTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1
                                            : audioTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 1)) * 100}%`,
                                        zIndex: 20
                                    }}
                                />
                            </div>

                            {/* Time indicators */}
                            <div className="flex justify-between text-xs text-blue-300 mt-1">
                                <span className="font-semibold">{formatTime(activeClipEditor.startPosition)}</span>
                                <span className="font-semibold">{formatTime(activeClipEditor.endPosition)}</span>
                                <span className="opacity-80">
                                    {formatTime((activeClipEditor.trackType === 'video'
                                        ? videoTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 0
                                        : audioTracks.find(t => t.id === activeClipEditor.trackId)?.duration || 0))}
                                </span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                className="border-blue-400/30 hover:bg-blue-500/20 text-blue-200"
                                onClick={cancelClipping}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-400"
                                onClick={applyClip}
                            >
                                Apply Clip
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Instructions tooltip */}
            <div className="absolute bottom-2 right-2 text-xs text-gray-500 opacity-60 pointer-events-none">
                <p>Scroll: ↕ Tracks | Shift+Scroll or two fingers: ↔ Timeline</p>
            </div>
        </div>
    );
};

export default CanvasTimeline; 