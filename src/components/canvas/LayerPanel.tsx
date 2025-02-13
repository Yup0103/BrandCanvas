import React from 'react';
import { fabric } from 'fabric';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Lock, Unlock, Layers, ChevronUp, ChevronDown, MoveUp, MoveDown } from 'lucide-react';

interface LayerPanelProps {
  canvas: fabric.Canvas | null;
  selectedObject: fabric.Object | null;
  onObjectSelect: (obj: fabric.Object | null) => void;
}

const LayerPanel: React.FC<LayerPanelProps> = ({ canvas, selectedObject, onObjectSelect }) => {
  if (!canvas) return null;

  const objects = canvas.getObjects();
  const layerCount = objects.length;

  const toggleVisibility = (obj: fabric.Object) => {
    obj.visible = !obj.visible;
    canvas.requestRenderAll();
  };

  const toggleLock = (obj: fabric.Object) => {
    const isLocked = obj.lockMovementX && obj.lockMovementY;
    obj.set({
      lockMovementX: !isLocked,
      lockMovementY: !isLocked,
      lockRotation: !isLocked,
      lockScalingX: !isLocked,
      lockScalingY: !isLocked,
    });
    canvas.requestRenderAll();
  };

  const moveLayer = (obj: fabric.Object, direction: 'up' | 'down') => {
    const currentIndex = canvas.getObjects().indexOf(obj);
    const newIndex = direction === 'up' ? currentIndex + 1 : currentIndex - 1;
    
    if (newIndex >= 0 && newIndex < layerCount) {
      canvas.moveTo(obj, newIndex);
      canvas.requestRenderAll();
    }
  };

  const getObjectName = (obj: fabric.Object): string => {
    if (obj instanceof fabric.IText) return `Text: ${obj.text?.substring(0, 15)}${obj.text?.length! > 15 ? '...' : ''}`;
    if (obj instanceof fabric.Image) return 'Image';
    if (obj instanceof fabric.Rect) return 'Rectangle';
    if (obj instanceof fabric.Circle) return 'Circle';
    if (obj instanceof fabric.Triangle) return 'Triangle';
    if (obj instanceof fabric.Path) return 'Path';
    return 'Object';
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4" />
        <h3 className="text-sm font-medium">Layers ({layerCount})</h3>
      </div>
      <Separator className="bg-purple-500/20" />
      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-2">
          {objects.slice().reverse().map((obj, index) => {
            const isSelected = selectedObject === obj;
            const isLocked = obj.lockMovementX && obj.lockMovementY;

            return (
              <div
                key={index}
                className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
                  isSelected ? 'bg-purple-500/20' : 'hover:bg-purple-500/10'
                }`}
                onClick={() => onObjectSelect(obj)}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVisibility(obj);
                  }}
                >
                  {obj.visible ? (
                    <Eye className="h-3 w-3" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLock(obj);
                  }}
                >
                  {isLocked ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    <Unlock className="h-3 w-3" />
                  )}
                </Button>
                <span className="flex-1 text-sm truncate">
                  {getObjectName(obj)}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(obj, 'up');
                    }}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(obj, 'down');
                    }}
                    disabled={index === layerCount - 1}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default LayerPanel;
