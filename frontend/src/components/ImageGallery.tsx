import { Download, Clock, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  source: 'api' | 'cache';
  cached: boolean;
  similarity?: number;
}

interface ImageGalleryProps {
  images: GeneratedImage[];
}

const ImageGallery = ({ images }: ImageGalleryProps) => {
  const downloadImage = (image: GeneratedImage) => {
    try {
      const link = document.createElement('a');
      link.href = image.imageUrl;
      link.download = `${image.prompt.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_')}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Download started",
        description: "Your browser is handling the download.",
      });
    } catch (error) {
      console.error('Error initiating image download:', error);
      toast({
        title: "Download failed",
        description: "Could not start the image download. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {images.map((image) => (
        <Card key={image.id} className="group overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="relative">
            {/* Image */}
            <div className="aspect-square overflow-hidden bg-gray-100">
              <img
                src={image.imageUrl}
                alt={image.prompt}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
            </div>
            
            {/* Download Button Overlay */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="icon"
                variant="secondary"
                onClick={() => downloadImage(image)}
                className="h-8 w-8 bg-white/90 hover:bg-white shadow-lg backdrop-blur-sm"
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>

            {/* Source Badge */}
            <div className="absolute top-2 left-2">
              <Badge 
                variant={image.cached ? "secondary" : "default"}
                className={`text-xs ${
                  image.cached 
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200" 
                    : "bg-green-100 text-green-700 hover:bg-green-200"
                }`}
              >
                {image.cached ? (
                  <><Clock className="w-3 h-3 mr-1" /> Cached</>
                ) : (
                  <><Zap className="w-3 h-3 mr-1" /> New</>
                )}
              </Badge>
            </div>
            
            {/* Similarity Score for Cached Images */}
            {image.cached && image.similarity && (
              <div className="absolute bottom-2 left-2">
                <Badge variant="outline" className="text-xs bg-white/90 backdrop-blur-sm">
                  {Math.round(image.similarity * 100)}% match
                </Badge>
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className="p-4">
            <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">
              {image.prompt}
            </p>
            
            {/* Action Button */}
            <Button
              onClick={() => downloadImage(image)}
              className="w-full mt-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              size="sm"
            >
              <>
                <Download className="w-4 h-4 mr-2" />
                Download
              </>
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default ImageGallery;
