import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Paperclip, Image, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChatInputProps {
  onSendMessage: (content: string, files?: File[]) => void;
  disabled?: boolean;
  model: string;
  onModelChange: (model: string) => void;
}

interface AttachedFile {
  file: File;
  preview?: string;
}

const models = [
  { value: "gpt-4-mini", label: "GPT-4 Mini" },
  { value: "gpt-4", label: "GPT-4" },
  { value: "gpt-4-mini-high", label: "GPT-4 Mini High" },
  { value: "gpt-3", label: "GPT-3.5" },
  { value: "gpt-3-mini", label: "GPT-3.5 Mini" },
  { value: "gemini-flash", label: "Gemini Flash" },
  { value: "gemini-pro", label: "Gemini Pro" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
  { value: "claude-opus-4", label: "Claude Opus 4" },
  { value: "grok-4", label: "Grok 4" },
  { value: "deepseek", label: "DeepSeek" },
];

const ChatInput = ({ onSendMessage, disabled, model, onModelChange }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && attachedFiles.length === 0) || disabled) return;

    const files = attachedFiles.map(af => af.file);
    onSendMessage(message.trim(), files);
    setMessage("");
    setAttachedFiles([]);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    const validFiles = files.filter(file => {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      const isText = file.type.startsWith('text/');
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (file.size > maxSize) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 10MB`,
          variant: "destructive",
        });
        return false;
      }

      if (!isImage && !isPdf && !isText) {
        toast({
          title: "Unsupported file type",
          description: `${file.name} is not supported. Please use images, PDFs, or text files.`,
          variant: "destructive",
        });
        return false;
      }

      return true;
    });

    const newAttachedFiles: AttachedFile[] = [];
    
    for (const file of validFiles) {
      const attachedFile: AttachedFile = { file };
      
      if (file.type.startsWith('image/')) {
        attachedFile.preview = URL.createObjectURL(file);
      }
      
      newAttachedFiles.push(attachedFile);
    }

    setAttachedFiles(prev => [...prev, ...newAttachedFiles]);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData?.items || []);
    const files = items
      .filter(item => item.kind === 'file')
      .map(item => item.getAsFile())
      .filter(Boolean) as File[];

    if (files.length > 0) {
      e.preventDefault();
      handleFiles(files);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => {
      const newFiles = [...prev];
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!);
      }
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const renderFilePreview = (attachedFile: AttachedFile, index: number) => {
    const { file, preview } = attachedFile;
    
    return (
      <Card key={index} className="relative inline-block">
        <CardContent className="p-2">
          <div className="flex items-center gap-2">
            {preview ? (
              <img src={preview} alt={file.name} className="w-8 h-8 object-cover rounded" />
            ) : (
              <div className="w-8 h-8 bg-muted rounded flex items-center justify-center">
                <Paperclip className="h-4 w-4" />
              </div>
            )}
            <span className="text-xs truncate max-w-20">{file.name}</span>
            <Button
              variant="ghost"
              size="sm"
              className="p-1 h-auto"
              onClick={() => removeFile(index)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="border-t border-border bg-background p-4">
      {/* Model selector */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Model:</span>
        <Select value={model} onValueChange={onModelChange}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {models.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* File previews */}
      {attachedFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachedFiles.map((attachedFile, index) => renderFilePreview(attachedFile, index))}
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Type your message... (Ctrl+V to paste images)"
            className="min-h-12 max-h-32 resize-none pr-12"
            disabled={disabled}
          />
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>
        
        <Button 
          type="submit" 
          disabled={(!message.trim() && attachedFiles.length === 0) || disabled}
          className="px-4"
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        accept="image/*,.pdf,.txt,.md,.json,.csv"
        className="hidden"
      />
    </div>
  );
};

export default ChatInput;