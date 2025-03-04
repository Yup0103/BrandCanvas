import React, { useState, useEffect } from 'react';
import { fabric } from 'fabric';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Play,
    Pause,
    Volume2,
    VolumeX,
    Crop,
    RotateCw,
    FlipHorizontal,
    FlipVertical,
    ArrowUpToLine,
    ArrowDownToLine,
    MoveUp,
    MoveDown,
    Lock,
    Unlock
} from 'lucide-react';
import MediaPlayer from './MediaPlayer';

interface MediaEditorProps {
    selectedObject: fabric.Object & {
        mediaElement?: HTMLVideoElement | HTMLAudioElement;
        getElement?: () => HTMLVideoElement | HTMLAudioElement;
    };
    canvas: fabric.Canvas | null;
    onSave: () => void;
    type: 'video' | 'audio';
}

const MediaEditor: React.FC<MediaEditorProps> = ({
    selectedObject,
    canvas,
    onSave,
    type
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [timelineVisible, setTimelineVisible] = useState(false);
    const [scrollAreaHeight, setScrollAreaHeight] = useState('calc(100vh - 60px)');

    // Get the media element
    const mediaElement = type === 'video'
        ? (selectedObject as any).getElement?.() as HTMLVideoElement
        : (selectedObject as any).mediaElement as HTMLAudioElement;

    // Effect to check if timeline is visible
    useEffect(() => {
        const checkTimelineVisibility = () => {
            // Check for timeline element
            const timelineElement = document.querySelector('[data-timeline="true"]');
            const timelineVisible = timelineElement !== null && window.getComputedStyle(timelineElement).display !== 'none';
            setTimelineVisible(timelineVisible);
            
            // Adjust height based on timeline visibility
            if (timelineVisible) {
                // Calculate timeline height (approximately 200px) or get actual height
                const timelineHeight = timelineElement ? timelineElement.clientHeight : 200;
                setScrollAreaHeight(`calc(100vh - 60px - ${timelineHeight}px)`);
            } else {
                setScrollAreaHeight('calc(100vh - 60px)');
            }
        };

        // Initial check
        checkTimelineVisibility();
        
        // Set up a mutation observer to detect changes to the DOM
        const observer = new MutationObserver(checkTimelineVisibility);
        observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            attributes: true
        });
        
        // Also listen for resize events
        window.addEventListener('resize', checkTimelineVisibility);
        
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', checkTimelineVisibility);
        };
    }, []);

    if (!selectedObject || !canvas || !mediaElement) return null;

    const updateOpacity = (value: number) => {
        selectedObject.set('opacity', value / 100);
        canvas.renderAll();
        onSave();
    };

    const updateWidth = (value: number) => {
        if (type === 'video') {
            selectedObject.set('width', value);
            canvas.renderAll();
            onSave();
        }
    };

    const updateHeight = (value: number) => {
        if (type === 'video') {
            selectedObject.set('height', value);
            canvas.renderAll();
            onSave();
        }
    };

    const updateRotation = (value: number) => {
        selectedObject.set('angle', value);
        canvas.renderAll();
        onSave();
    };

    const handleLockToggle = () => {
        const isLocked = selectedObject.lockMovementX && selectedObject.lockMovementY;
        selectedObject.set({
            lockMovementX: !isLocked,
            lockMovementY: !isLocked,
            lockRotation: !isLocked,
            lockScalingX: !isLocked,
            lockScalingY: !isLocked,
        });
        canvas.renderAll();
        onSave();
    };

    const handleFlip = (direction: 'horizontal' | 'vertical') => {
        if (direction === 'horizontal') {
            selectedObject.set('flipX', !selectedObject.flipX);
        } else {
            selectedObject.set('flipY', !selectedObject.flipY);
        }
        canvas.renderAll();
        onSave();
    };

    // Layer ordering functions
    const bringToFront = () => {
        const objects = canvas.getObjects();
        const maxIndex = objects.length - 1;
        canvas.moveTo(selectedObject, maxIndex);
        canvas.requestRenderAll();
        onSave();
    };

    const sendToBack = () => {
        canvas.moveTo(selectedObject, 0);
        canvas.requestRenderAll();
        onSave();
    };

    const bringForward = () => {
        const currentIndex = canvas.getObjects().indexOf(selectedObject);
        const maxIndex = canvas.getObjects().length - 1;
        if (currentIndex < maxIndex) {
            canvas.moveTo(selectedObject, currentIndex + 1);
            canvas.requestRenderAll();
            onSave();
        }
    };

    const sendBackward = () => {
        const currentIndex = canvas.getObjects().indexOf(selectedObject);
        if (currentIndex > 0) {
            canvas.moveTo(selectedObject, currentIndex - 1);
            canvas.requestRenderAll();
            onSave();
        }
    };

    const isLocked = selectedObject.lockMovementX && selectedObject.lockMovementY;

    return (
        <ScrollArea className="h-full" style={{ height: scrollAreaHeight }}>
            <div className="p-4 space-y-6">
                <MediaPlayer
                    mediaObject={selectedObject as any}
                    canvas={canvas}
                    type={type}
                />

                <Tabs defaultValue="properties">
                    <TabsList className="grid grid-cols-2">
                        <TabsTrigger value="properties">Properties</TabsTrigger>
                        <TabsTrigger value="layout">Layout</TabsTrigger>
                    </TabsList>

                    <TabsContent value="properties" className="space-y-4 pt-4">
                        {/* Opacity control */}
                        <div className="space-y-2">
                            <Label>Opacity</Label>
                            <div className="flex items-center gap-4">
                                <Slider
                                    value={[selectedObject.opacity * 100]}
                                    min={0}
                                    max={100}
                                    step={1}
                                    onValueChange={val => updateOpacity(val[0])}
                                    className="flex-1"
                                />
                                <span className="w-12 text-center">{Math.round(selectedObject.opacity * 100)}%</span>
                            </div>
                        </div>

                        {/* Size controls for video */}
                        {type === 'video' && (
                            <>
                                <div className="space-y-2">
                                    <Label>Width</Label>
                                    <div className="flex items-center gap-4">
                                        <Slider
                                            value={[selectedObject.width as number]}
                                            min={50}
                                            max={1000}
                                            step={1}
                                            onValueChange={val => updateWidth(val[0])}
                                            className="flex-1"
                                        />
                                        <span className="w-12 text-center">{Math.round(selectedObject.width as number)}px</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Height</Label>
                                    <div className="flex items-center gap-4">
                                        <Slider
                                            value={[selectedObject.height as number]}
                                            min={50}
                                            max={1000}
                                            step={1}
                                            onValueChange={val => updateHeight(val[0])}
                                            className="flex-1"
                                        />
                                        <span className="w-12 text-center">{Math.round(selectedObject.height as number)}px</span>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Rotation control */}
                        <div className="space-y-2">
                            <Label>Rotation</Label>
                            <div className="flex items-center gap-4">
                                <Slider
                                    value={[selectedObject.angle || 0]}
                                    min={0}
                                    max={360}
                                    step={1}
                                    onValueChange={val => updateRotation(val[0])}
                                    className="flex-1"
                                />
                                <span className="w-12 text-center">{Math.round(selectedObject.angle || 0)}°</span>
                            </div>
                        </div>

                        {/* Flip controls */}
                        <div className="space-y-2">
                            <Label>Flip</Label>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant={selectedObject.flipX ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleFlip('horizontal')}
                                    className="flex-1"
                                >
                                    <FlipHorizontal className="h-4 w-4 mr-2" />
                                    Horizontal
                                </Button>
                                <Button
                                    variant={selectedObject.flipY ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => handleFlip('vertical')}
                                    className="flex-1"
                                >
                                    <FlipVertical className="h-4 w-4 mr-2" />
                                    Vertical
                                </Button>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="layout" className="space-y-4 pt-4">
                        {/* Lock controls */}
                        <div className="space-y-2">
                            <Label>Lock</Label>
                            <Button
                                variant={isLocked ? "default" : "outline"}
                                onClick={handleLockToggle}
                                className="w-full"
                            >
                                {isLocked ? (
                                    <>
                                        <Lock className="h-4 w-4 mr-2" />
                                        Unlock
                                    </>
                                ) : (
                                    <>
                                        <Unlock className="h-4 w-4 mr-2" />
                                        Lock
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Layer ordering */}
                        <div className="space-y-2">
                            <Label>Layer Order</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={bringToFront}
                                >
                                    <ArrowUpToLine className="h-4 w-4 mr-2" />
                                    Bring to Front
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={sendToBack}
                                >
                                    <ArrowDownToLine className="h-4 w-4 mr-2" />
                                    Send to Back
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={bringForward}
                                >
                                    <MoveUp className="h-4 w-4 mr-2" />
                                    Bring Forward
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={sendBackward}
                                >
                                    <MoveDown className="h-4 w-4 mr-2" />
                                    Send Backward
                                </Button>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </ScrollArea>
    );
};

export default MediaEditor; 