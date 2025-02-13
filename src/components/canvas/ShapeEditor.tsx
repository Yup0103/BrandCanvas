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

const ShapeEditor: React.FC<ShapeEditorProps> = ({ selectedObject, canvas, onSave }) => {
  const [isCropping, setIsCropping] = useState(false);
  const [fillType, setFillType] = useState<'solid' | 'gradient'>('solid');
  
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

  const updateFill = (value: string) => {
    selectedObject.set('fill', value);
    canvas.renderAll();
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

  if (!selectedObject || !canvas) return null;

  const isImage = selectedObject instanceof fabric.Image;
  const isLocked = selectedObject?.lockMovementX && selectedObject?.lockMovementY;

  return (
    <ScrollArea className="h-[calc(100vh-4rem)]">
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
              <div className="space-y-2">
                <Label>Fill Type</Label>
                <Select
                  value={fillType}
                  onValueChange={(value: 'solid' | 'gradient') => setFillType(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select fill type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solid">Solid Color</SelectItem>
                    <SelectItem value="gradient">Gradient</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {fillType === 'solid' ? (
                <div className="space-y-2">
                  <Label>Fill Color</Label>
                  <Input
                    type="color"
                    value={selectedObject.fill?.toString() || '#000000'}
                    onChange={(e) => updateFill(e.target.value)}
                    className="bg-purple-900/20 border-purple-500/20 h-10"
                  />
                </div>
              ) : (
                <GradientPicker
                  selectedObject={selectedObject}
                  canvas={canvas}
                  onSave={onSave}
                />
              )}

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
