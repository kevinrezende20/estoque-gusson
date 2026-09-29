import { useState, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import imageCompression from "browser-image-compression";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Camera, Eraser, Check, FileUp, FileText, Loader2, X, Plus } from "lucide-react";

export type ChecklistSignatureResult = {
  photo: File;
  signature: string; // base64
  checklistFiles: File[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  requireChecklist?: boolean;
  onSave: (result: ChecklistSignatureResult) => void;
};

export function ChecklistSignatureDialog({ open, onOpenChange, title, description, requireChecklist = true, onSave }: Props) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [checklistFiles, setChecklistFiles] = useState<File[]>([]);
  
  const sigCanvas = useRef<SignatureCanvas>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      try {
        setIsCompressing(true);
        const options = {
          maxSizeMB: 0.5, // 500KB máximo
          maxWidthOrHeight: 1280, // Limitar resolução
          useWebWorker: true,
        };
        
        const compressedFile = await imageCompression(file, options);
        setPhoto(compressedFile);
        setPhotoPreview(URL.createObjectURL(compressedFile));
      } catch (error) {
        console.error("Erro ao comprimir imagem:", error);
        // Fallback em caso de erro
        setPhoto(file);
        setPhotoPreview(URL.createObjectURL(file));
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setChecklistFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeChecklistFile = (index: number) => {
    setChecklistFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleClearSignature = () => {
    sigCanvas.current?.clear();
  };

  const isFormValid = () => {
    const checklistValid = requireChecklist ? checklistFiles.length > 0 : true;
    return photo !== null && checklistValid && sigCanvas.current && !sigCanvas.current.isEmpty();
  };

  const handleSave = () => {
    if (!isFormValid()) return;

    const signatureBase64 = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
    
    onSave({
      photo: photo!,
      signature: signatureBase64!,
      checklistFiles: checklistFiles,
    });
    
    // Reset state
    setPhoto(null);
    setPhotoPreview(null);
    setChecklistFiles([]);
    sigCanvas.current?.clear();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl border-border bg-popover/95 p-0 backdrop-blur-xl sm:max-w-xl"
        onInteractOutside={(e) => { e.preventDefault(); }} // Require explicit cancel/save
      >
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 py-5">
          {/* FOTO */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">1. Foto do Material (Obrigatório)</Label>
            <div className="rounded-xl border border-dashed border-border/50 bg-muted/30 p-4 text-center transition-colors hover:bg-muted/50 relative">
              {isCompressing && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl">
                  <Loader2 className="size-6 text-primary animate-spin mb-2" />
                  <span className="text-xs font-medium">Otimizando foto...</span>
                </div>
              )}
              <Input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                id="camera-input"
                onChange={handlePhotoChange}
              />
              <Label htmlFor="camera-input" className="cursor-pointer flex flex-col items-center gap-2">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="h-32 rounded-lg object-cover" />
                ) : (
                  <>
                    <Camera className="size-8 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Tirar Foto ou Anexar</span>
                  </>
                )}
              </Label>
              {photoPreview && (
                <Button variant="ghost" size="sm" className="mt-2 text-destructive" onClick={() => { setPhoto(null); setPhotoPreview(null); }}>
                  Remover Foto
                </Button>
              )}
            </div>
          </div>

          {/* ARQUIVO CHECKLIST */}
          {requireChecklist && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">2. Arquivo de Checklist (Obrigatório)</Label>
            <div className="rounded-xl border border-dashed border-border/50 bg-muted/30 p-4 text-center transition-colors hover:bg-muted/50">
              <Input 
                type="file" 
                multiple
                accept=".pdf,.doc,.docx" 
                className="hidden" 
                id="checklist-input"
                onChange={handleFileChange}
              />
              <Label htmlFor="checklist-input" className="cursor-pointer flex flex-col items-center gap-2">
                {checklistFiles.length > 0 ? (
                  <div className="flex flex-col items-center gap-2 w-full">
                    {checklistFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between w-full max-w-[280px] bg-background p-2 rounded-lg border border-border">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText className="size-4 text-primary shrink-0" />
                          <span className="text-xs font-medium text-foreground truncate">{file.name}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0 ml-2" onClick={(e) => { e.preventDefault(); removeChecklistFile(idx); }}>
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                    <div className="mt-2 flex items-center text-sm font-medium text-primary gap-1">
                      <Plus className="size-4" /> Adicionar mais arquivos
                    </div>
                  </div>
                ) : (
                  <>
                    <FileUp className="size-8 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Anexar .PDF ou .WORD</span>
                  </>
                )}
              </Label>
            </div>
          </div>
          )}

          {/* ASSINATURA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">{requireChecklist ? "3" : "2"}. Assinatura Digital (Obrigatório)</Label>
              <Button type="button" variant="ghost" size="sm" onClick={handleClearSignature} className="h-8 text-xs text-muted-foreground">
                <Eraser className="size-3 mr-1" /> Limpar
              </Button>
            </div>
            <div className="rounded-xl border border-border/50 bg-white overflow-hidden shadow-inner">
              {/* @ts-expect-error Type incompatibility with React 18 */}
              <SignatureCanvas 
                ref={sigCanvas} 
                penColor="black"
                canvasProps={{ className: "w-full h-40 cursor-crosshair" }} 
              />
            </div>
            <p className="text-[10px] text-muted-foreground text-center">Assine no espaço em branco acima</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 bg-muted/20">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!isFormValid()} className="shadow-sm shadow-primary/30">
            <Check className="size-4 mr-2" /> Salvar e Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
