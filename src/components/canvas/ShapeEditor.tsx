import React, { useState, useCallback, useEffect } from 'react';
import { fabric } from 'fabric';
import { Canvas } from 'fabric/fabric-impl';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import LayerPanel from './LayerPanel';
import {
  Copy,
  Trash2,
  Lock,
  Unlock,
  Crop,
  RotateCw,
  ChevronUp,
  ChevronDown,
  MoveUp,
  MoveDown,
  ArrowUpToLine,
  ArrowDownToLine,
  FlipHorizontal,
  FlipVertical,
  Maximize2,
  Eye,
  EyeOff,
  Layers
} from 'lucide-react';
import ImageCropper from './ImageCropper';
import GradientPicker from './GradientPicker'; // Fix the import statement for GradientPicker component
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ShapeEditorProps {
  selectedObject: fabric.Object;
  canvas: fabric.Canvas | null;
  onSave: () => void;
}

const blendModes = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
];

const gradientTypes = [
  'linear',
  'radial',
];

interface Filters {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  warmth: number;
  shadows: number;
  highlights: number;
}

// Extend the fabric Object interface to include rx and ry properties for TypeScript
declare module 'fabric/fabric-impl' {
  interface Object {
    rx?: number;
    ry?: number;
  }
}

const ShapeEditor: React.FC<ShapeEditorProps> = ({ selectedObject, canvas, onSave }) => {
  const [isCropping, setIsCropping] = useState(false);
  const [fillType, setFillType] = useState<'solid' | 'gradient'>(
    selectedObject.fill instanceof fabric.Gradient ? 'gradient' : 'solid'
  );
  const [selectedColor, setSelectedColor] = useState<string>(
    selectedObject.fill instanceof fabric.Gradient
      ? (selectedObject.fill.colorStops?.[0]?.color || '#000000')
      : (selectedObject.fill?.toString() || '#000000')
  );
  const [gradientAngle, setGradientAngle] = useState<number>(0);
  const [gradientStops, setGradientStops] = useState<Array<{ offset: number; color: string }>>([
    { offset: 0, color: '#ffffff' },
    { offset: 1, color: '#000000' },
  ]);
  const [selectedStop, setSelectedStop] = useState<number>(0);
  const [isDraggingStop, setIsDraggingStop] = useState(false);
  const [gradientType, setGradientType] = useState<'linear' | 'radial'>('linear');
  const [timelineVisible, setTimelineVisible] = useState(false);
  const [scrollAreaHeight, setScrollAreaHeight] = useState('calc(100vh - 4rem)');

  // Predefined colors for gradient swatches
  const predefinedColors = ['#FFFFFF', '#808080', '#A05252', '#A35B5B', '#FF00FF'];

  // Gradient style presets
  const gradientStyles = [
    {
      id: 'horizontal',
      name: 'Horizontal',
      type: 'linear',
      angle: 0,
      preview: 'linear-gradient(to right, #A05252, #FFFFFF)'
    },
    {
      id: 'vertical',
      name: 'Vertical',
      type: 'linear',
      angle: 90,
      preview: 'linear-gradient(to bottom, #A05252, #FFFFFF)'
    },
    {
      id: 'diagonal',
      name: 'Diagonal',
      type: 'linear',
      angle: 45,
      preview: 'linear-gradient(45deg, #A05252, #FFFFFF)'
    },
    {
      id: 'radial',
      name: 'Radial',
      type: 'radial',
      angle: 0,
      preview: 'radial-gradient(circle, #FFFFFF, #A05252)'
    },
    {
      id: 'reflected',
      name: 'Reflected',
      type: 'linear',
      angle: 0,
      reflected: true,
      preview: 'linear-gradient(to right, #A05252, #FFFFFF, #A05252)'
    }
  ];

  const defaultFilters: Filters = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    exposure: 100,
    warmth: 0,
    shadows: 0,
    highlights: 0
  };

  const [filters, setFilters] = useState<Filters>(defaultFilters);

  const applyImageFilters = useCallback((filterType: keyof Filters, value: number) => {
    if (!selectedObject || !canvas || !(selectedObject instanceof fabric.Image)) return;

    const imgObject = selectedObject as fabric.Image;

    // Initialize filters array if it doesn't exist
    if (!imgObject.filters) {
      imgObject.filters = [];
    }

    // Apply brightness
    if (filters.brightness !== 100) {
      const brightnessFilter = new fabric.Image.filters.Brightness({
        brightness: (filters.brightness - 100) / 100
      });
      imgObject.filters[0] = brightnessFilter;
    }

    // Apply contrast
    if (filters.contrast !== 100) {
      const contrastFilter = new fabric.Image.filters.Contrast({
        contrast: (filters.contrast - 100) / 100
      });
      imgObject.filters[1] = contrastFilter;
    }

    // Apply saturation
    if (filters.saturation !== 100) {
      const saturationFilter = new fabric.Image.filters.Saturation({
        saturation: (filters.saturation - 100) / 100
      });
      imgObject.filters[2] = saturationFilter;
    }

    // Apply exposure (gamma)
    if (filters.exposure !== 100) {
      const exposureFilter = new fabric.Image.filters.Gamma({
        gamma: [filters.exposure / 100, filters.exposure / 100, filters.exposure / 100]
      });
      imgObject.filters[3] = exposureFilter;
    }

    // Apply warmth using color matrix
    if (filters.warmth !== 0) {
      const warmthValue = filters.warmth / 100;
      const warmthFilter = new fabric.Image.filters.ColorMatrix({
        matrix: [
          1 + warmthValue, 0, 0, 0, 0,
          0, 1, 0, 0, 0,
          0, 0, 1 - warmthValue, 0, 0,
          0, 0, 0, 1, 0
        ]
      });
      imgObject.filters[4] = warmthFilter;
    }

    // Apply shadows and highlights
    if (filters.shadows !== 0 || filters.highlights !== 0) {
      const shadowValue = Math.max(-filters.shadows / 100, 0);
      const highlightValue = Math.max(filters.highlights / 100, 0);
      const shadowsFilter = new fabric.Image.filters.Brightness({
        brightness: shadowValue
      });
      imgObject.filters[5] = shadowsFilter;
    }

    try {
      // Apply all filters
      if (typeof imgObject.applyFilters === 'function') {
        imgObject.applyFilters();
        canvas.requestRenderAll();
      }
    } catch (error) {
      console.error('Error applying filters:', error);
    }
  }, [selectedObject, canvas, filters]);

  const handleFilterChange = (filterType: keyof Filters, value: number) => {
    setFilters(prev => {
      const newFilters = { ...prev, [filterType]: value };
      return newFilters;
    });
    applyImageFilters(filterType, value);
  };

  // Apply filters when the selected object changes
  useEffect(() => {
    if (selectedObject instanceof fabric.Image) {
      applyImageFilters('brightness', filters.brightness);
    }
  }, [selectedObject]);

  // Initialize gradient settings if the object has a gradient fill
  useEffect(() => {
    if (selectedObject && selectedObject.fill instanceof fabric.Gradient) {
      setFillType('gradient');
      const gradient = selectedObject.fill as fabric.Gradient;

      // Initialize gradient stops
      const stops = gradient.colorStops?.map(stop => ({
        offset: stop.offset || 0,
        color: stop.color || '#000000',
      })) || [];
      setGradientStops(stops);

      // Set initial selected color from the first stop
      if (stops.length > 0) {
        setSelectedColor(stops[0].color);
      }

      // Set gradient type
      setGradientType(gradient.type as 'linear' | 'radial');

      // Calculate angle from coords if it's a linear gradient
      if (gradient.type === 'linear' && gradient.coords) {
        const { x1, y1, x2, y2 } = gradient.coords;
        const angleRad = Math.atan2(y2 - y1, x2 - x1);
        const angleDeg = Math.round((angleRad * 180) / Math.PI);
        setGradientAngle(angleDeg);
      }
    } else {
      setFillType('solid');
      // Set initial selected color from the fill
      if (selectedObject.fill && typeof selectedObject.fill === 'string') {
        setSelectedColor(selectedObject.fill);
      }
    }
  }, [selectedObject]);

  const updateFill = (value: string) => {
    if (fillType === 'solid') {
      selectedObject.set('fill', value);
    } else {
      applyGradient();
    }
    canvas.renderAll();
  };

  // Apply gradient to the selected object
  const applyGradient = () => {
    if (!selectedObject || !canvas) return;

    if (gradientType === 'linear') {
      // Calculate coordinates based on angle
      const angleRad = (gradientAngle * Math.PI) / 180;
      const width = selectedObject.width || 100;
      const height = selectedObject.height || 100;
      const r = Math.max(width, height) / 2;
      const x1 = -r * Math.cos(angleRad) + r;
      const y1 = -r * Math.sin(angleRad) + r;
      const x2 = r * Math.cos(angleRad) + r;
      const y2 = r * Math.sin(angleRad) + r;

      const gradient = new fabric.Gradient({
        type: 'linear',
        coords: {
          x1: x1,
          y1: y1,
          x2: x2,
          y2: y2,
        },
        colorStops: gradientStops.map(stop => ({
          offset: stop.offset,
          color: stop.color,
        })),
      });

      selectedObject.set('fill', gradient);
    } else if (gradientType === 'radial') {
      // Create a radial gradient
      const width = selectedObject.width || 100;
      const height = selectedObject.height || 100;
      const r = Math.max(width, height) / 2;

      const gradient = new fabric.Gradient({
        type: 'radial',
        coords: {
          r1: 0,
          r2: r,
          x1: r,
          y1: r,
          x2: r,
          y2: r,
        },
        colorStops: gradientStops.map(stop => ({
          offset: stop.offset,
          color: stop.color,
        })),
      });

      selectedObject.set('fill', gradient);
    }

    canvas.requestRenderAll();
    onSave();
  };

  // Apply a gradient style preset
  const applyGradientStyle = (styleId: string) => {
    const style = gradientStyles.find(s => s.id === styleId);
    if (!style) return;

    setGradientType(style.type as 'linear' | 'radial');
    setGradientAngle(style.angle);

    if (style.reflected) {
      // For reflected gradients, redistribute the stops to create a reflection effect
      const currentColors = gradientStops.map(stop => stop.color);
      const midColor = currentColors[0];
      const edgeColor = currentColors[currentColors.length - 1];

      setGradientStops([
        { offset: 0, color: edgeColor },
        { offset: 0.5, color: midColor },
        { offset: 1, color: edgeColor }
      ]);
    }

    setTimeout(() => applyGradient(), 0);
  };

  // Create a new gradient with selected colors
  const createGradientFromColors = (colors: string[]) => {
    if (colors.length < 2) return;

    const newStops = colors.map((color, index) => ({
      offset: index / (colors.length - 1),
      color
    }));

    setGradientStops(newStops);
    setTimeout(() => applyGradient(), 0);
  };

  // Add a new gradient stop
  const addGradientStop = () => {
    if (gradientStops.length < 2) return;

    const newStops = [...gradientStops];
    // Add new stop in the middle
    const newOffset = (gradientStops[selectedStop].offset + gradientStops[selectedStop + 1]?.offset || 1) / 2;
    newStops.splice(selectedStop + 1, 0, {
      offset: newOffset,
      color: gradientStops[selectedStop].color,
    });
    setGradientStops(newStops);
    setSelectedStop(selectedStop + 1);
    applyGradient();
  };

  // Remove a gradient stop
  const removeGradientStop = (index: number) => {
    if (gradientStops.length <= 2) return; // Keep at least 2 stops
    const newStops = gradientStops.filter((_, i) => i !== index);
    setGradientStops(newStops);
    setSelectedStop(Math.min(selectedStop, newStops.length - 1));
    applyGradient();
  };

  // Update color of the selected gradient stop
  const updateGradientStopColor = (color: string) => {
    const newStops = [...gradientStops];
    newStops[selectedStop].color = color;
    setGradientStops(newStops);
    applyGradient();
  };

  // Update position of the selected gradient stop
  const updateGradientStopPosition = (offset: number) => {
    const newStops = [...gradientStops];
    newStops[selectedStop].offset = offset;
    // Sort stops by offset
    newStops.sort((a, b) => a.offset - b.offset);
    setGradientStops(newStops);
    setSelectedStop(newStops.findIndex(stop => stop.offset === offset));
    applyGradient();
  };

  // Handle gradient stop drag
  const handleGradientStopDrag = (e: React.MouseEvent, index: number, containerRef: HTMLDivElement) => {
    e.preventDefault();
    setSelectedStop(index);
    setIsDraggingStop(true);

    const startX = e.clientX;
    const rect = containerRef.getBoundingClientRect();
    const startOffset = gradientStops[index].offset;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - startX;
      const percentMove = dx / rect.width;
      const newOffset = Math.max(0, Math.min(1, startOffset + percentMove));
      updateGradientStopPosition(newOffset);
    };

    const handleMouseUp = () => {
      setIsDraggingStop(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const updateStroke = (value: string) => {
    selectedObject.set('stroke', value);
    canvas.renderAll();
  };

  const updateStrokeWidth = (value: number) => {
    selectedObject.set('strokeWidth', value);
    canvas.renderAll();
  };

  const updateOpacity = (value: number) => {
    selectedObject.set('opacity', value / 100);
    canvas.renderAll();
  };

  const updateWidth = (value: number) => {
    selectedObject.set('width', value);
    canvas.renderAll();
  };

  const updateHeight = (value: number) => {
    selectedObject.set('height', value);
    canvas.renderAll();
  };

  const updateRotation = (value: number) => {
    selectedObject.set('angle', value);
    canvas.renderAll();
  };

  // Update border radius with proper type casting
  const updateBorderRadius = (value: number) => {
    if (!selectedObject || !canvas) return;

    const isImage = selectedObject.type === 'image';
    const isShape = selectedObject.type === 'rect' || selectedObject.type === 'triangle';

    if (isShape) {
      // For regular shapes, use type assertion to set rx and ry properties
      (selectedObject as any).set('rx', value);
      (selectedObject as any).set('ry', value);
      canvas.renderAll();
    } else if (isImage) {
      // For images, we need to use clipPath to create rounded corners
      const width = selectedObject.width * (selectedObject.scaleX || 1);
      const height = selectedObject.height * (selectedObject.scaleY || 1);

      // Create a rectangle with the same dimensions as the image
      const rect = new fabric.Rect({
        width: width,
        height: height,
        rx: value,
        ry: value,
        originX: 'center',
        originY: 'center'
      });

      // Set the rectangle as the clipPath for the image and store radius value
      selectedObject.set({
        clipPath: rect,
      });

      // Store the rx/ry values on the object for reference using type assertion
      (selectedObject as any).rx = value;
      (selectedObject as any).ry = value;

      canvas.renderAll();
    }

    if (onSave) onSave();
  };

  const updateBlendMode = (value: string) => {
    selectedObject.set('globalCompositeOperation', value);
    canvas.renderAll();
  };

  const updateGradient = (type: string) => {
    const coords = type === 'linear'
      ? { x1: 0, y1: 0, x2: selectedObject.width, y2: 0 }
      : { r1: 0, r2: selectedObject.width / 2, x1: selectedObject.width / 2, y1: selectedObject.height / 2, x2: selectedObject.width / 2, y2: selectedObject.height / 2 };

    const gradient = type === 'linear'
      ? new fabric.Gradient({
        type: 'linear',
        coords,
        colorStops: [
          { offset: 0, color: '#000' },
          { offset: 1, color: '#fff' }
        ]
      })
      : new fabric.Gradient({
        type: 'radial',
        coords,
        colorStops: [
          { offset: 0, color: '#000' },
          { offset: 1, color: '#fff' }
        ]
      });

    selectedObject.set('fill', gradient);
    canvas.renderAll();
  };

  const flipObject = (direction: 'horizontal' | 'vertical') => {
    if (direction === 'horizontal') {
      selectedObject.set('flipX', !selectedObject.flipX);
    } else {
      selectedObject.set('flipY', !selectedObject.flipY);
    }
    canvas.renderAll();
  };

  const duplicateObject = () => {
    if (!selectedObject || !canvas) return;

    selectedObject.clone((cloned: fabric.Object) => {
      cloned.set({
        left: cloned.left! + 20,
        top: cloned.top! + 20,
        evented: true,
      });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.renderAll();
    });
  };

  const deleteObject = () => {
    if (!selectedObject || !canvas) return;
    canvas.remove(selectedObject);
  };

  const toggleLock = () => {
    selectedObject.set({
      lockMovementX: !selectedObject.lockMovementX,
      lockMovementY: !selectedObject.lockMovementY,
      lockRotation: !selectedObject.lockRotation,
      lockScalingX: !selectedObject.lockScalingX,
      lockScalingY: !selectedObject.lockScalingY,
    });
    canvas.renderAll();
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    if (selectedObject && selectedObject instanceof fabric.Image && canvas) {
      const imgObject = selectedObject as fabric.Image;
      imgObject.filters = [];
      imgObject.applyFilters();
      canvas.requestRenderAll();
    }
  };

  const handleRotationChange = (value: number[]) => {
    if (!selectedObject || !canvas) return;
    selectedObject.rotate(value[0]);
    canvas.renderAll();
  };

  const handleScaleChange = (value: number[]) => {
    if (!selectedObject) return;
    const scale = value[0] / 100;
    selectedObject.scale(scale);
    canvas.renderAll();
  };

  const handleAspectLockToggle = () => {
    if (!selectedObject) return;
    selectedObject.lockUniScaling = !selectedObject.lockUniScaling;
    canvas.renderAll();
  };

  const handleCrop = () => {
    if (!selectedObject || !isImage) return;
    setIsCropping(true);
  };

  const handleCropFinish = () => {
    setIsCropping(false);
  };

  const handleCropCancel = () => {
    setIsCropping(false);
  };

  const handleFlip = (direction: 'horizontal' | 'vertical') => {
    if (!selectedObject) return;
    if (direction === 'horizontal') {
      selectedObject.flipX = !selectedObject.flipX;
    } else {
      selectedObject.flipY = !selectedObject.flipY;
    }
    canvas.renderAll();
  };

  // Layer ordering functions
  const bringToFront = () => {
    if (!selectedObject || !canvas) return;

    // Get all objects and find the top-most z-index
    const objects = canvas.getObjects();
    const maxIndex = objects.length - 1;

    // Move the object to the end of the stack
    canvas.moveTo(selectedObject, maxIndex);
    canvas.requestRenderAll();
  };

  const sendToBack = () => {
    if (!selectedObject || !canvas) return;

    // Move the object to the start of the stack
    canvas.moveTo(selectedObject, 0);
    canvas.requestRenderAll();
  };

  const bringForward = () => {
    if (!selectedObject || !canvas) return;

    // Get current index and move one step forward if possible
    const currentIndex = canvas.getObjects().indexOf(selectedObject);
    const maxIndex = canvas.getObjects().length - 1;
    if (currentIndex < maxIndex) {
      canvas.moveTo(selectedObject, currentIndex + 1);
      canvas.requestRenderAll();
    }
  };

  const sendBackward = () => {
    if (!selectedObject || !canvas) return;

    // Get current index and move one step backward if possible
    const currentIndex = canvas.getObjects().indexOf(selectedObject);
    if (currentIndex > 0) {
      canvas.moveTo(selectedObject, currentIndex - 1);
      canvas.requestRenderAll();
    }
  };

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
        setScrollAreaHeight(`calc(100vh - 4rem - ${timelineHeight}px)`);
      } else {
        setScrollAreaHeight('calc(100vh - 4rem)');
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

  if (!selectedObject || !canvas) return null;

  const isImage = selectedObject instanceof fabric.Image;
  const isLocked = selectedObject?.lockMovementX && selectedObject?.lockMovementY;

  return (
    <ScrollArea className="h-full" style={{ height: scrollAreaHeight }}>
      <div className="space-y-4 p-4">
        <Tabs defaultValue="arrange" className="w-full">
          <TabsList className="w-full sticky top-0 bg-background z-10">
            <TabsTrigger value="arrange" className="flex-1">Arrange</TabsTrigger>
            <TabsTrigger value="style" className="flex-1">Style</TabsTrigger>
            <TabsTrigger value="layers" className="flex-1">Layers</TabsTrigger>
          </TabsList>

          <TabsContent value="arrange">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-sm font-medium">Position & Size</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => bringToFront()}
                    className="hover:bg-purple-500/20"
                  >
                    <MoveUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => sendToBack()}
                    className="hover:bg-purple-500/20"
                  >
                    <MoveDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => bringForward()}
                    className="hover:bg-purple-500/20"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => sendBackward()}
                    className="hover:bg-purple-500/20"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Size</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    value={Math.round(selectedObject.width || 0)}
                    onChange={(e) => updateWidth(Number(e.target.value))}
                    className="bg-purple-900/20 border-purple-500/20"
                    placeholder="Width"
                  />
                  <Input
                    type="number"
                    value={Math.round(selectedObject.height || 0)}
                    onChange={(e) => updateHeight(Number(e.target.value))}
                    className="bg-purple-900/20 border-purple-500/20"
                    placeholder="Height"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Rotation</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    defaultValue={[selectedObject.angle || 0]}
                    max={360}
                    step={1}
                    onValueChange={handleRotationChange}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleRotationChange([0])}
                    className="h-8 w-8"
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Scale</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    defaultValue={[selectedObject.scaleX ? selectedObject.scaleX * 100 : 100]}
                    max={200}
                    step={1}
                    onValueChange={handleScaleChange}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleScaleChange([100])}
                    className="h-8 w-8"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator className="my-4 bg-purple-500/20" />

              <div className="space-y-2">
                <Label>Layer Position</Label>
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={bringToFront}
                    className="hover:bg-purple-500/20"
                    title="Bring to Front"
                  >
                    <ArrowUpToLine className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={bringForward}
                    className="hover:bg-purple-500/20"
                    title="Bring Forward"
                  >
                    <MoveUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={sendBackward}
                    className="hover:bg-purple-500/20"
                    title="Send Backward"
                  >
                    <MoveDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={sendToBack}
                    className="hover:bg-purple-500/20"
                    title="Send to Back"
                  >
                    <ArrowDownToLine className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator className="my-4 bg-purple-500/20" />

              <div className="grid grid-cols-4 gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => flipObject('horizontal')}
                  className="hover:bg-purple-500/20"
                >
                  <FlipHorizontal className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => flipObject('vertical')}
                  className="hover:bg-purple-500/20"
                >
                  <FlipVertical className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={duplicateObject}
                  className="hover:bg-purple-500/20"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleLock}
                  className="hover:bg-purple-500/20"
                >
                  {isLocked ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <Unlock className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {isImage && (
                <>
                  <Separator className="my-4 bg-purple-500/20" />

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Image Controls</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCrop}
                        className="flex items-center gap-1"
                        disabled={isCropping}
                      >
                        <Crop className="h-4 w-4" />
                        Crop
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFlip('horizontal')}
                        disabled={isCropping}
                      >
                        Flip H
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleFlip('vertical')}
                        disabled={isCropping}
                      >
                        Flip V
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAspectLockToggle}
                        disabled={isCropping}
                      >
                        {selectedObject.lockUniScaling ? (
                          <Lock className="h-4 w-4" />
                        ) : (
                          <Unlock className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {isImage && (
                <>
                  <Separator className="my-4 bg-purple-500/20" />
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-medium">Image Adjustments</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                        className="flex items-center gap-1"
                      >
                        <RotateCw className="h-3 w-3" />
                        Reset
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Brightness</Label>
                          <span className="text-xs text-gray-400">{filters.brightness}%</span>
                        </div>
                        <Slider
                          value={[filters.brightness]}
                          onValueChange={(value) => handleFilterChange('brightness', value[0])}
                          min={0}
                          max={200}
                          step={1}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Contrast</Label>
                          <span className="text-xs text-gray-400">{filters.contrast}%</span>
                        </div>
                        <Slider
                          value={[filters.contrast]}
                          onValueChange={(value) => handleFilterChange('contrast', value[0])}
                          min={0}
                          max={200}
                          step={1}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Saturation</Label>
                          <span className="text-xs text-gray-400">{filters.saturation}%</span>
                        </div>
                        <Slider
                          value={[filters.saturation]}
                          onValueChange={(value) => handleFilterChange('saturation', value[0])}
                          min={0}
                          max={200}
                          step={1}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Exposure</Label>
                          <span className="text-xs text-gray-400">{filters.exposure}%</span>
                        </div>
                        <Slider
                          value={[filters.exposure]}
                          onValueChange={(value) => handleFilterChange('exposure', value[0])}
                          min={0}
                          max={200}
                          step={1}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Warmth</Label>
                          <span className="text-xs text-gray-400">{filters.warmth}</span>
                        </div>
                        <Slider
                          value={[filters.warmth]}
                          onValueChange={(value) => handleFilterChange('warmth', value[0])}
                          min={-100}
                          max={100}
                          step={1}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Shadows</Label>
                          <span className="text-xs text-gray-400">{filters.shadows}</span>
                        </div>
                        <Slider
                          value={[filters.shadows]}
                          onValueChange={(value) => handleFilterChange('shadows', value[0])}
                          min={-100}
                          max={100}
                          step={1}
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Highlights</Label>
                          <span className="text-xs text-gray-400">{filters.highlights}</span>
                        </div>
                        <Slider
                          value={[filters.highlights]}
                          onValueChange={(value) => handleFilterChange('highlights', value[0])}
                          min={-100}
                          max={100}
                          step={1}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <Button
                variant="destructive"
                className="w-full"
                onClick={deleteObject}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Shape
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="layers">
            <LayerPanel
              canvas={canvas}
              selectedObject={selectedObject}
              onObjectSelect={(obj) => {
                if (canvas && obj) {
                  canvas.setActiveObject(obj);
                  canvas.requestRenderAll();
                }
              }}
            />
          </TabsContent>

          <TabsContent value="style">
            <div className="space-y-4">
              <div className="space-y-4">
                {/* Unified Color Picker Widget */}
                <div className="space-y-2">
                  <Label>Fill</Label>
                  <Tabs
                    defaultValue={fillType}
                    onValueChange={(value) => {
                      const newFillType = value as 'solid' | 'gradient';
                      setFillType(newFillType);

                      if (newFillType === 'gradient') {
                        // Initialize gradient with current fill color if it's solid
                        if (!(selectedObject.fill instanceof fabric.Gradient)) {
                          const currentColor = selectedObject.fill?.toString() || '#000000';
                          setGradientStops([
                            { offset: 0, color: currentColor },
                            { offset: 1, color: '#ffffff' },
                          ]);
                          applyGradient();
                        }
                      }
                    }}
                  >
                    <TabsList className="w-full grid grid-cols-2">
                      <TabsTrigger value="solid">Solid colour</TabsTrigger>
                      <TabsTrigger value="gradient">Gradient</TabsTrigger>
                    </TabsList>

                    <div className="p-2 border rounded-md mt-2 bg-background/30">
                      {/* Common Color Selector - Visible in Both Tabs */}
                      <div className="space-y-2 mb-4">
                        <Label>Color</Label>
                        <div className="flex items-center space-x-2">
                          {predefinedColors.map((color, index) => (
                            <div
                              key={index}
                              className="w-8 h-8 rounded-full border border-gray-400 cursor-pointer flex items-center justify-center"
                              style={{
                                backgroundColor: color,
                                boxShadow: (fillType === 'solid' && selectedColor === color) ||
                                  (fillType === 'gradient' && gradientStops.some(stop => stop.color === color))
                                  ? '0 0 0 2px rgba(147, 51, 234, 0.5)'
                                  : 'none'
                              }}
                              onClick={() => {
                                if (fillType === 'solid') {
                                  // Update solid color
                                  setSelectedColor(color);
                                  updateFill(color);
                                } else {
                                  // Update gradient stop color
                                  const newStops = [...gradientStops];
                                  newStops[selectedStop].color = color;
                                  setGradientStops(newStops);
                                  applyGradient();
                                }
                              }}
                            >
                              {index === predefinedColors.length - 1 && (
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-white/80">
                                  <span className="text-black text-lg font-semibold">+</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <Input
                          type="color"
                          value={fillType === 'solid' ? selectedColor : gradientStops[selectedStop]?.color || '#000000'}
                          onChange={(e) => {
                            const newColor = e.target.value;
                            if (fillType === 'solid') {
                              setSelectedColor(newColor);
                              updateFill(newColor);
                            } else {
                              updateGradientStopColor(newColor);
                            }
                          }}
                          className="mt-2 bg-purple-900/20 border-purple-500/20 h-10"
                        />
                      </div>

                      <TabsContent value="solid" className="mt-2">
                        <div className="flex justify-center p-4 bg-slate-800/50 rounded-md">
                          <div className="w-24 h-24 rounded-md" style={{ backgroundColor: selectedColor }}></div>
                        </div>
                      </TabsContent>

                      <TabsContent value="gradient" className="space-y-4 mt-2">
                        {/* Gradient Style Selection */}
                        <div className="space-y-2">
                          <Label>Style</Label>
                          <div className="grid grid-cols-5 gap-2">
                            {gradientStyles.map((style) => (
                              <div
                                key={style.id}
                                className={`h-12 rounded-md cursor-pointer border-2 transition-all ${(gradientType === style.type &&
                                  ((gradientType === 'linear' && gradientAngle === style.angle) ||
                                    gradientType === 'radial'))
                                  ? 'border-purple-500'
                                  : 'border-transparent hover:border-purple-300'
                                  }`}
                                style={{ background: style.preview }}
                                onClick={() => applyGradientStyle(style.id)}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Gradient Angle (only show for linear gradients) */}
                        {gradientType === 'linear' && (
                          <div className="space-y-2">
                            <Label>Angle</Label>
                            <div className="flex items-center gap-2">
                              <Slider
                                value={[gradientAngle]}
                                onValueChange={([value]) => {
                                  setGradientAngle(value);
                                  applyGradient();
                                }}
                                max={360}
                                step={1}
                              />
                              <Input
                                type="number"
                                value={gradientAngle}
                                onChange={(e) => {
                                  const value = Number(e.target.value);
                                  setGradientAngle(value);
                                  applyGradient();
                                }}
                                className="w-20"
                              />
                            </div>
                          </div>
                        )}

                        {/* Gradient Stops Editor */}
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <Label>Preview</Label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={addGradientStop}
                              disabled={gradientStops.length >= 10}
                            >
                              Add Stop
                            </Button>
                          </div>

                          <div
                            className="h-12 rounded-md relative cursor-pointer mt-2"
                            ref={(ref) => {
                              if (ref) {
                                ref.addEventListener('click', (e) => {
                                  if (isDraggingStop) return;
                                  const rect = ref.getBoundingClientRect();
                                  const offset = (e.clientX - rect.left) / rect.width;
                                  // Only add new stop if clicking between stops
                                  if (!gradientStops.some(stop => Math.abs(stop.offset - offset) < 0.05)) {
                                    const newStops = [...gradientStops];
                                    const newStop = {
                                      offset,
                                      color: gradientStops[selectedStop]?.color || '#000000'
                                    };
                                    newStops.push(newStop);
                                    newStops.sort((a, b) => a.offset - b.offset);
                                    setGradientStops(newStops);
                                    setSelectedStop(newStops.findIndex(stop => stop === newStop));
                                    applyGradient();
                                  }
                                });
                              }
                            }}
                            style={{
                              background: gradientType === 'linear'
                                ? `linear-gradient(${gradientAngle}deg, ${gradientStops
                                  .map((stop) => `${stop.color} ${stop.offset * 100}%`)
                                  .join(', ')})`
                                : `radial-gradient(circle, ${gradientStops
                                  .map((stop) => `${stop.color} ${stop.offset * 100}%`)
                                  .join(', ')})`
                            }}
                          >
                            {gradientStops.map((stop, index) => (
                              <div
                                key={index}
                                className={`absolute -translate-x-1/2 group ${selectedStop === index ? 'z-10' : 'z-0'}`}
                                style={{
                                  left: `${stop.offset * 100}%`,
                                  top: '0',
                                  bottom: '0',
                                }}
                              >
                                <div
                                  className={`absolute bottom-0 w-4 h-4 -mb-2 rounded-full border-2 cursor-grab active:cursor-grabbing transition-shadow ${selectedStop === index ? 'border-white shadow-lg' : 'border-gray-400'}`}
                                  style={{
                                    backgroundColor: stop.color,
                                  }}
                                  onClick={() => setSelectedStop(index)}
                                  onMouseDown={(e) => handleGradientStopDrag(e, index, e.currentTarget.parentElement?.parentElement as HTMLDivElement)}
                                />

                                {gradientStops.length > 2 && (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="absolute -top-8 left-1/2 -translate-x-1/2 w-5 h-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/20 hover:bg-red-500/40 border-red-500/50"
                                    onClick={() => removeGradientStop(index)}
                                  >
                                    <span className="text-xs">×</span>
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>

                <div className="space-y-2">
                  <Label>Stroke Color</Label>
                  <Input
                    type="color"
                    value={selectedObject.stroke?.toString() || '#000000'}
                    onChange={(e) => updateStroke(e.target.value)}
                    className="bg-purple-900/20 border-purple-500/20 h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Stroke Width</Label>
                  <Slider
                    value={[selectedObject.strokeWidth || 0]}
                    onValueChange={(value) => updateStrokeWidth(value[0])}
                    min={0}
                    max={20}
                    step={1}
                    className="bg-purple-900/20"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Opacity</Label>
                  <Slider
                    value={[selectedObject.opacity ? selectedObject.opacity * 100 : 100]}
                    onValueChange={(value) => updateOpacity(value[0])}
                    min={0}
                    max={100}
                    step={1}
                    className="bg-purple-900/20"
                  />
                </div>

                {/* Add Border Radius control for rectangles, triangles and images */}
                {(selectedObject.type === 'rect' || selectedObject.type === 'triangle' || selectedObject.type === 'image') && (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label>Border Radius</Label>
                      <span className="text-xs text-gray-400">{(selectedObject as any).rx || 0}px</span>
                    </div>
                    <Slider
                      value={[(selectedObject as any).rx || 0]}
                      onValueChange={(value) => updateBorderRadius(value[0])}
                      min={0}
                      max={Math.min(
                        (selectedObject.width || 0) * (selectedObject.scaleX || 1),
                        (selectedObject.height || 0) * (selectedObject.scaleY || 1)
                      ) / 2} // Maximum radius is half of the smallest dimension
                      step={1}
                      className="bg-purple-900/20"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Blend Mode</Label>
                  <Select onValueChange={updateBlendMode}>
                    <SelectTrigger className="bg-purple-900/20 border-purple-500/20">
                      <SelectValue placeholder="Select blend mode" />
                    </SelectTrigger>
                    <SelectContent>
                      {blendModes.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {isCropping && isImage && (
        <ImageCropper
          canvas={canvas}
          imageObject={selectedObject as fabric.Image}
          onFinish={handleCropFinish}
          onCancel={handleCropCancel}
        />
      )}
    </ScrollArea>
  );
};

export default ShapeEditor;
