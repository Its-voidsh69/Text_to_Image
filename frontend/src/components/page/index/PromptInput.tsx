
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload } from 'lucide-react';

interface PromptInputProps {
  handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileName: string;
  promptsFromFile: string[];
  isGenerating: 'file' | 'single' | null;
  generateImages: () => void;
  generatingIndex: number | null;
  singlePrompt: string;
  setSinglePrompt: (value: string) => void;
  generateSingleImage: () => void;
}

const PromptInput = ({
  handleFileUpload,
  fileName,
  promptsFromFile,
  isGenerating,
  generateImages,
  generatingIndex,
  singlePrompt,
  setSinglePrompt,
  generateSingleImage,
}: PromptInputProps) => {
  return (
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
  );
};

export default PromptInput;
