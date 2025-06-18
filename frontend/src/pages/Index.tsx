
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Download, Trash2, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import ImageGallery from '@/components/ImageGallery';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  source: 'api' | 'cache';
  cached: boolean;
  similarity?: number;
}

const getImageBlob = (imageUrl: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas to Blob conversion failed'));
        }
      }, 'image/webp');
    };
    img.onerror = () => {
      reject(new Error(`Failed to load image from ${imageUrl}. This is likely a CORS issue.`));
    };
    img.src = imageUrl;
  });
};

const Index = () => {
  const [promptsFromFile, setPromptsFromFile] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [singlePrompt, setSinglePrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState<'file' | 'single' | null>(null);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [isZipping, setIsZipping] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'txt') {
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const prompts = content.split('\n').map(p => p.trim()).filter(Boolean);
        setPromptsFromFile(prompts);
        toast({
          title: "File loaded",
          description: `Found ${prompts.length} prompts in ${file.name}.`,
        });
      };
      reader.readAsText(file);
    } else if (fileExtension === 'csv' || fileExtension === 'xlsx') {
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
          const prompts = json.flat().map(p => String(p).trim()).filter(Boolean);
          setPromptsFromFile(prompts);
          toast({
            title: "File loaded",
            description: `Found ${prompts.length} prompts in ${file.name}.`,
          });
        } catch (error) {
          console.error("Error parsing file:", error);
          toast({
            title: "File parsing error",
            description: "Could not read prompts from the file. Please check the format.",
            variant: "destructive",
          });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a .txt, .csv, or .xlsx file.",
        variant: "destructive"
      });
      setFileName('');
    }
    // Reset file input value to allow re-uploading the same file
    event.target.value = '';
  };

  const generateSingleImage = async () => {
    const prompt = singlePrompt.trim();
    if (!prompt) {
      toast({
        title: "No prompt provided",
        description: "Please enter a prompt to generate an image.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating('single');

    try {
      const response = await fetch('http://localhost:5001/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate image for: ${prompt}`);
      }

      const data = await response.json();
      const newImage: GeneratedImage = {
        id: Date.now() + '',
        prompt,
        imageUrl: `http://localhost:5001${data.imageUrl}`,
        source: data.source,
        cached: data.cached,
        similarity: data.similarity
      };

      setGeneratedImages(prev => [newImage, ...prev]);
      setSinglePrompt('');

      toast({
        title: "Image generated!",
        description: `${data.cached ? 'Retrieved from cache' : 'Generated new image'} for: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`,
      });
    } catch (error) {
      console.error('Error generating image:', error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(null);
    }
  };

  const generateImages = async () => {
    const validPrompts = promptsFromFile.filter(p => p.trim());
    if (validPrompts.length === 0) {
      toast({
        title: "No prompts provided",
        description: "Please upload a file with prompts to generate images.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating('file');
    const newImages: GeneratedImage[] = [];

    try {
      for (let i = 0; i < validPrompts.length; i++) {
        setGeneratingIndex(i);
        const prompt = validPrompts[i];
        
        const response = await fetch('http://localhost:5001/api/generate-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
          throw new Error(`Failed to generate image for: ${prompt}`);
        }

        const data = await response.json();
        newImages.push({
          id: Date.now() + i + '',
          prompt,
          imageUrl: `http://localhost:5001${data.imageUrl}`,
          source: data.source,
          cached: data.cached,
          similarity: data.similarity
        });

        toast({
          title: "Image generated!",
          description: `${data.cached ? 'Retrieved from cache' : 'Generated new image'} for: ${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}`,
        });
      }

      setGeneratedImages(prev => [...prev, ...newImages]);
      setPromptsFromFile([]); // Reset prompts
      setFileName(''); // Reset file name
    } catch (error) {
      console.error('Error generating images:', error);
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(null);
      setGeneratingIndex(null);
    }
  };

  const downloadAllImages = async () => {
    if (generatedImages.length === 0 || isZipping) return;

    setIsZipping(true);
    const { id: toastId, update: updateToast } = toast({
      title: "Preparing your download...",
      description: `Zipping ${generatedImages.length} images. This may take a moment.`,
    });

    const zip = new JSZip();
    let failedDownloads = 0;

    try {
      await Promise.all(generatedImages.map(async (image) => {
        try {
          const blob = await getImageBlob(image.imageUrl);
          const fileName = `${image.prompt.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_') || 'untitled'}.webp`;
          zip.file(fileName, blob);
        } catch (e) {
          console.error(`Could not add image for prompt "${image.prompt}" to zip.`, e);
          failedDownloads++;
        }
      }));

      const successfulDownloads = Object.keys(zip.files).length;

      if (successfulDownloads === 0) {
        updateToast({
          id: toastId,
          title: "Download failed",
          description: "Could not retrieve any images. This is likely a CORS issue. Check the browser console for details.",
          variant: "destructive",
        });
        setIsZipping(false);
        return;
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'generated-images.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      let description = `Your zip file with ${successfulDownloads} images has been downloaded.`;
      if (failedDownloads > 0) {
        description += ` ${failedDownloads} image(s) failed to download.`;
      }

      updateToast({
        id: toastId,
        title: "Download ready!",
        description,
      });

    } catch (error) {
      console.error('Error creating zip file:', error);
      updateToast({
        id: toastId,
        title: "Download failed",
        description: "An unexpected error occurred while creating the zip file.",
        variant: "destructive"
      });
    } finally {
      setIsZipping(false);
    }
  };

  const clearAllImages = () => {
    setGeneratedImages([]);
    setPromptsFromFile([]);
    setFileName('');
    toast({
      title: "Gallery cleared",
      description: "All generated images have been removed.",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent mb-4">
            AI Image Generator
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Create stunning images from your text descriptions. 
          </p>
        </div>

        {/* Input Section */}
        <Card className="mb-8 p-6 shadow-lg">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Upload Prompts File</h2>
          <p className="text-sm text-gray-500 mb-4">Upload a .txt, .csv, or .xlsx file with one prompt per line or cell.</p>
          
          <div className="flex flex-wrap items-center gap-4">
            <Button asChild variant="outline" className="shrink-0">
              <label htmlFor="file-upload" className="cursor-pointer flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <span>{fileName ? 'Change File' : 'Upload File'}</span>
              </label>
            </Button>
            <input 
              id="file-upload" 
              type="file" 
              className="hidden" 
              onChange={handleFileUpload} 
              accept=".txt,.csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              disabled={isGenerating !== null} 
            />

            {fileName && (
              <div className="text-sm text-gray-700 bg-gray-100 px-3 py-1.5 rounded-md">
                File: <span className="font-medium">{fileName}</span>
              </div>
            )}
             {promptsFromFile.length > 0 && (
              <div className="text-sm text-green-700 bg-green-100 px-3 py-1.5 rounded-md">
                <span className="font-medium">{promptsFromFile.length} prompts loaded</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <Button
              onClick={generateImages}
              disabled={isGenerating !== null || promptsFromFile.length === 0}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {isGenerating === 'file' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating {generatingIndex !== null ? `(${generatingIndex + 1}/${promptsFromFile.filter(p => p.trim()).length})` : '...'}
                </>
              ) : (
                <>Generate from File</>
              )}
            </Button>
          </div>

          <div className="my-6 flex items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink mx-4 text-gray-500 text-sm">OR</span>
            <div className="flex-grow border-t border-gray-300"></div>
          </div>

          <h2 className="text-xl font-semibold mb-4 text-gray-800">Generate a Single Image</h2>
          <div className="flex items-end gap-3">
              <div className="w-full">
                  <Label htmlFor="single-prompt" className="sr-only">Single Prompt</Label>
                  <Input
                      id="single-prompt"
                      type="text"
                      placeholder="e.g., a photorealistic cat sitting on a couch"
                      value={singlePrompt}
                      onChange={(e) => setSinglePrompt(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && singlePrompt.trim()) generateSingleImage() }}
                      disabled={isGenerating !== null}
                  />
              </div>
              <Button
                  onClick={generateSingleImage}
                  disabled={isGenerating !== null || !singlePrompt.trim()}
              >
                  {isGenerating === 'single' ? (
                      <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Generating...
                      </>
                  ) : (
                      "Generate"
                  )}
              </Button>
          </div>
        </Card>

        {/* Gallery Controls */}
        {generatedImages.length > 0 && (
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-800">
              Generated Images ({generatedImages.length})
            </h2>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={downloadAllImages}
                disabled={isZipping}
                className="flex items-center gap-2"
              >
                {isZipping ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Zipping...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download All
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={clearAllImages}
                disabled={isZipping}
                className="flex items-center gap-2 text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
                Clear All
              </Button>
            </div>
          </div>
        )}

        {/* Image Gallery */}
        <ImageGallery images={generatedImages} />

        {/* Empty State */}
        {generatedImages.length === 0 && !isGenerating && (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full"></div>
            </div>
            <h3 className="text-xl font-medium text-gray-600 mb-2">No images generated yet</h3>
            <p className="text-gray-500">Upload a file with prompts and click "Generate Images" to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
