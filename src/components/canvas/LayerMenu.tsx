import React, { useState } from 'react';
import { fabric } from 'fabric';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Group, Ungroup, Eye, EyeOff, Trash2, Lock, Unlock, Pencil, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface LayerMenuProps {
  canvas: fabric.Canvas | null;
  onGroup: () => void;
  onUngroup: () => void;
  selectedObject: fabric.Object | null;
  onSaveHistory: () => void;
}

export const LayerMenu: React.FC<LayerMenuProps> = ({
  canvas,
  onGroup,
  onUngroup,
  selectedObject,
  onSaveHistory,
}) => {
  const [objects, setObjects] = React.useState<fabric.Object[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  React.useEffect(() => {
    if (!canvas) return;

    const updateObjects = () => {
      setObjects([...canvas.getObjects()].reverse());
    };

    canvas.on('object:added', updateObjects);
    canvas.on('object:removed', updateObjects);
    canvas.on('object:modified', updateObjects);

    // Initial objects
    updateObjects();

    return () => {
      canvas.off('object:added', updateObjects);
      canvas.off('object:removed', updateObjects);
      canvas.off('object:modified', updateObjects);
    };
  }, [canvas]);

  const handleVisibilityToggle = (obj: fabric.Object) => {
    if (!canvas) return;
    obj.visible = !obj.visible;
    canvas.requestRenderAll();
    onSaveHistory();
  };

  const handleLockToggle = (obj: fabric.Object) => {
    if (!canvas) return;
    obj.lockMovementX = !obj.lockMovementX;
    obj.lockMovementY = !obj.lockMovementY;
    canvas.requestRenderAll();
    onSaveHistory();
  };

  const handleDelete = (obj: fabric.Object) => {
    if (!canvas) return;
    canvas.remove(obj);
    canvas.requestRenderAll();
    onSaveHistory();
  };

  const handleObjectSelect = (obj: fabric.Object) => {
    if (!canvas) return;
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
  };

  const startEditing = (obj: fabric.Object) => {
    const id = obj.data?.id || Math.random().toString(36).substr(2, 9);
    obj.data = { ...obj.data, id };
    setEditingId(id);
    setEditingName(obj.data?.name || getObjectLabel(obj));
  };

  const saveEditing = (obj: fabric.Object) => {
    obj.data = { ...obj.data, name: editingName };
    setEditingId(null);
    onSaveHistory();
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const getObjectLabel = (obj: fabric.Object): string => {
    // If object has a custom name, use it
    if (obj.data?.name) {
      return obj.data.name;
    }

    // For images, try to get the file name
    if (obj.type === 'image' && (obj as any).file) {
      return (obj as any).file.name;
    }

    // Default type-based labels
    const typeLabels: { [key: string]: string } = {
      group: 'Group',
      textbox: 'Text',
      image: 'Image',
      rect: 'Rectangle',
      circle: 'Circle',
    };

    return typeLabels[obj.type || ''] || 'Object';
  };

  const canGroup = canvas?.getActiveObjects().length > 1;
  const canUngroup = selectedObject?.type === 'group';

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Layers</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onGroup}
            disabled={!canGroup}
            title="Group selected objects"
          >
            <Group className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onUngroup}
            disabled={!canUngroup}
            title="Ungroup selected objects"
          >
            <Ungroup className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="h-[calc(100vh-20rem)]">
        <div className="space-y-2">
          {objects.map((obj, index) => (
            <div
              key={obj.data?.id || index}
              className={`flex items-center justify-between p-2 rounded ${
                obj === selectedObject ? 'bg-accent' : 'hover:bg-accent/50'
              }`}
              onClick={() => handleObjectSelect(obj)}
            >
              {editingId === obj.data?.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="h-6 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        saveEditing(obj);
                      } else if (e.key === 'Escape') {
                        cancelEditing();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      saveEditing(obj);
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelEditing();
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 truncate">{getObjectLabel(obj)}</span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(obj);
                      }}
                      title="Rename"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVisibilityToggle(obj);
                      }}
                      title={obj.visible ? 'Hide' : 'Show'}
                    >
                      {obj.visible ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLockToggle(obj);
                      }}
                      title={obj.lockMovementX ? 'Unlock' : 'Lock'}
                    >
                      {obj.lockMovementX ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        <Unlock className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(obj);
                      }}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
