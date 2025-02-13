import React, { useState } from 'react';
import { fabric } from 'fabric';
import Cropper from 'react-cropper';
import 'cropperjs/dist/cropper.css';
import { Button } from "@/components/ui/button";
import { Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ImageCropperProps {
  canvas: fabric.Canvas;
  imageObject: fabric.Image;
  onFinish: () => void;
  onCancel: () => void;
}

const ImageCropper: React.FC<ImageCropperProps> = ({
  canvas,
  imageObject,
  onFinish,
  onCancel,
}) => {
  const [cropper, setCropper] = useState<any>();

  // Get the image source from the fabric.Image object
  const imgElement = imageObject.getElement() as HTMLImageElement;
  const imageUrl = imgElement.src;

  const handleCrop = () => {
    if (!cropper) return;

    // Get the cropped canvas data
    const croppedCanvas = cropper.getCroppedCanvas();
    
    // Convert to image URL
    const croppedImageUrl = croppedCanvas.toDataURL();

    // Create new fabric.Image with cropped image
    fabric.Image.fromURL(croppedImageUrl, (croppedImg) => {
      // Set the position to the original image position
      const imgBounds = imageObject.getBoundingRect();
      croppedImg.set({
        left: imgBounds.left,
        top: imgBounds.top,
        scaleX: 1,
        scaleY: 1,
      });

      // Remove the original image and add the cropped one
      canvas.remove(imageObject);
      canvas.add(croppedImg);
      canvas.setActiveObject(croppedImg);
      canvas.renderAll();

      onFinish();
    });
  };

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-[900px] w-[90vw]">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
        </DialogHeader>
        
        <div className="w-full aspect-video relative bg-black/50">
          <Cropper
            src={imageUrl}
            style={{ height: '100%', width: '100%' }}
            initialAspectRatio={1}
            guides={true}
            viewMode={1}
            dragMode="crop"
            toggleDragModeOnDblclick={false}
            cropBoxMovable={true}
            cropBoxResizable={true}
            onInitialized={(instance) => setCropper(instance)}
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={onCancel}
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleCrop}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Check className="h-4 w-4 mr-1" />
            Apply Crop
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageCropper;
