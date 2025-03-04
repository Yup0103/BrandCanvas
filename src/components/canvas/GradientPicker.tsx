import React, { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { fabric } from 'fabric';

interface GradientStop {
  offset: number;
  color: string;
}

interface GradientPickerProps {
  selectedObject: fabric.Object;
  canvas: fabric.Canvas | null;
  onSave: () => void;
}

const GradientPicker: React.FC<GradientPickerProps> = ({
  selectedObject,
  canvas,
  onSave,
}) => {
  const [stops, setStops] = useState<GradientStop[]>([
    { offset: 0, color: '#ffffff' },
    { offset: 1, color: '#000000' },
  ]);
  const [selectedStop, setSelectedStop] = useState<number>(0);
  const [angle, setAngle] = useState<number>(0);
  const [dragging, setDragging] = useState(false);

  // Initialize gradient from object if it exists
  React.useEffect(() => {
    if (selectedObject && selectedObject.fill instanceof fabric.Gradient) {
      const gradient = selectedObject.fill as fabric.Gradient;
      const newStops = gradient.colorStops?.map(stop => ({
        offset: stop.offset || 0,
        color: stop.color || '#000000',
      })) || [];
      setStops(newStops);

      // Calculate angle from coords
      if (gradient.coords) {
        const { x1, y1, x2, y2 } = gradient.coords;
        const angleRad = Math.atan2(y2 - y1, x2 - x1);
        const angleDeg = (angleRad * 180) / Math.PI;
        setAngle(angleDeg);
      }
    }
  }, [selectedObject]);

  const applyGradient = () => {
    if (!selectedObject || !canvas) return;

    // Calculate coordinates based on angle
    const angleRad = (angle * Math.PI) / 180;
    const r = Math.max(selectedObject.width || 0, selectedObject.height || 0) / 2;
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
      colorStops: stops.map(stop => ({
        offset: stop.offset,
        color: stop.color,
      })),
    });

    selectedObject.set('fill', gradient);
    canvas.requestRenderAll();
    onSave();
  };

  const addStop = () => {
    const newStops = [...stops];
    // Add new stop in the middle
    const newOffset = (stops[selectedStop].offset + stops[selectedStop + 1]?.offset || 1) / 2;
    newStops.splice(selectedStop + 1, 0, {
      offset: newOffset,
      color: stops[selectedStop].color,
    });
    setStops(newStops);
    setSelectedStop(selectedStop + 1);
  };

  const removeStop = (index: number) => {
    if (stops.length <= 2) return; // Keep at least 2 stops
    const newStops = stops.filter((_, i) => i !== index);
    setStops(newStops);
    setSelectedStop(Math.min(selectedStop, newStops.length - 1));
  };

  const updateStopColor = (color: string) => {
    const newStops = [...stops];
    newStops[selectedStop].color = color;
    setStops(newStops);
    applyGradient();
  };

  const updateStopPosition = (offset: number) => {
    const newStops = [...stops];
    newStops[selectedStop].offset = offset;
    // Sort stops by offset
    newStops.sort((a, b) => a.offset - b.offset);
    setStops(newStops);
    setSelectedStop(newStops.findIndex(stop => stop.offset === offset));
    applyGradient();
  };

  const handleStopDrag = (e: React.MouseEvent, index: number, containerRef: HTMLDivElement) => {
    e.preventDefault();
    setSelectedStop(index);
    setDragging(true);

    const startX = e.clientX;
    const rect = containerRef.getBoundingClientRect();
    const startOffset = stops[index].offset;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - startX;
      const percentMove = dx / rect.width;
      const newOffset = Math.max(0, Math.min(1, startOffset + percentMove));
      updateStopPosition(newOffset);
    };

    const handleMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Gradient Angle</Label>
        <div className="flex items-center gap-2">
          <Slider
            value={[angle]}
            onValueChange={([value]) => {
              setAngle(value);
              applyGradient();
            }}
            max={360}
            step={1}
          />
          <Input
            type="number"
            value={angle}
            onChange={(e) => {
              const value = Number(e.target.value);
              setAngle(value);
              applyGradient();
            }}
            className="w-20"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Gradient Stops</Label>
        <div className="space-y-4">
          <div
            className="h-12 rounded-md relative cursor-pointer"
            ref={(ref) => {
              if (ref) {
                ref.addEventListener('click', (e) => {
                  if (dragging) return;
                  const rect = ref.getBoundingClientRect();
                  const offset = (e.clientX - rect.left) / rect.width;
                  // Only add new stop if clicking between stops
                  if (!stops.some(stop => Math.abs(stop.offset - offset) < 0.05)) {
                    const newStops = [...stops];
                    const newStop = {
                      offset,
                      color: stops[selectedStop]?.color || '#000000'
                    };
                    newStops.push(newStop);
                    newStops.sort((a, b) => a.offset - b.offset);
                    setStops(newStops);
                    setSelectedStop(newStops.findIndex(stop => stop === newStop));
                    applyGradient();
                  }
                });
              }
            }}
            style={{
              background: `linear-gradient(to right, ${stops
                .map((stop) => `${stop.color} ${stop.offset * 100}%`)
                .join(', ')})`,
            }}
          >
            {stops.map((stop, index) => (
              <div
                key={index}
                className={`absolute -translate-x-1/2 group ${selectedStop === index ? 'z-10' : 'z-0'
                  }`}
                style={{
                  left: `${stop.offset * 100}%`,
                  top: '0',
                  bottom: '0',
                }}
              >
                <div
                  className={`absolute bottom-0 w-4 h-4 -mb-2 rounded-full border-2 cursor-grab active:cursor-grabbing transition-shadow ${selectedStop === index ? 'border-white shadow-lg' : 'border-gray-400'
                    }`}
                  style={{
                    backgroundColor: stop.color,
                  }}
                  onMouseDown={(e) => handleStopDrag(e, index, e.currentTarget.parentElement?.parentElement as HTMLDivElement)}
                />

                <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(stop.offset * 100)}
                    onChange={(e) => {
                      const value = Math.max(0, Math.min(100, Number(e.target.value)));
                      updateStopPosition(value / 100);
                    }}
                    className="w-16 h-6 text-xs px-1"
                  />
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute -top-12 left-1/2 -translate-x-1/2 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ backgroundColor: stop.color }}
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <HexColorPicker
                      color={stop.color}
                      onChange={(color) => updateStopColor(color)}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            ))}
          </div>

          {/* Add/Remove buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addStop}
              disabled={stops.length >= 5}
            >
              Add Stop
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => removeStop(selectedStop)}
              disabled={stops.length <= 2}
            >
              Remove Stop
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradientPicker;
