import { useState, useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import imageCompression from "browser-image-compression";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Camera, Eraser, Check, FileUp, FileText, Loader2, X, Plus } from "lucide-react";

export type DeliverySignatureResult = {
  photos: File[];
  signatureDriver: string; // base64
  signatureNurse: string; // base64
  checklistFile: File | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onSave: (result: DeliverySignatureResult) => void;
};

export function DeliverySignatureDialog({ open, onOpenChange, title, description, onSave }: Props) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [checklistFile, setChecklistFile] = useState<File | null>(null);
  
  const sigDriverCanvas = useRef<SignatureCanvas>(null);
  const sigNurseCanvas = useRef<SignatureCanvas>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIsCompressing(true);
      const newPhotos: File[] = [];
      const newPreviews: string[] = [];

      try {
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1280,
          useWebWorker: true,
        };
        
        for (let i = 0; i < e.target.files.length; i++) {
          const file = e.target.files[i];
          const compressedFile = await imageCompression(file, options);
          newPhotos.push(compressedFile);
          newPreviews.push(URL.createObjectURL(compressedFile));
        }

        setPhotos(prev => [...prev, ...newPhotos]);
        setPhotoPreviews(prev => [...prev, ...newPreviews]);
      } catch (error) {
        console.error("Erro ao comprimir imagem:", error);
      } finally {
        setIsCompressing(false);
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setChecklistFile(e.target.files[0]);
    }
  };

  const handleClearSignatureDriver = () => {
    sigDriverCanvas.current?.clear();
  };

  const handleClearSignatureNurse = () => {
    sigNurseCanvas.current?.clear();
  };

  const isFormValid = () => {
    return photos.length > 0 && 
           sigDriverCanvas.current && !sigDriverCanvas.current.isEmpty() &&
           sigNurseCanvas.current && !sigNurseCanvas.current.isEmpty();
  };

  const handleSave = () => {
    if (!isFormValid()) return;

    const signatureDriverBase64 = sigDriverCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
    const signatureNurseBase64 = sigNurseCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
    
    onSave({
      photos,
      signatureDriver: signatureDriverBase64!,
      signatureNurse: signatureNurseBase64!,
      checklistFile,
    });
    
    // Reset state
    setPhotos([]);
    setPhotoPreviews([]);
    setChecklistFile(null);
    sigDriverCanvas.current?.clear();
    sigNurseCanvas.current?.clear();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl border-border bg-popover/95 p-0 backdrop-blur-xl sm:max-w-xl"
        onInteractOutside={(e) => { e.preventDefault(); }}
      >
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="font-display text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-8 px-6 py-5">
          {/* FOTOS MULTIPLAS */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-primary/20 text-primary text-xs">1</span>
              Fotos (Obrigatório, pode ser mais de uma)
            </Label>
            <div className="rounded-xl border border-dashed border-border/50 bg-muted/30 p-4 relative">
              {isCompressing && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-xl">
                  <Loader2 className="size-6 text-primary animate-spin mb-2" />
                  <span className="text-xs font-medium">Otimizando foto(s)...</span>
                </div>
              )}
              
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {photoPreviews.map((preview, idx) => (
                    <div key={idx} className="relative group">
                      <img src={preview} alt={`Preview ${idx+1}`} className="h-24 w-full rounded-lg object-cover border border-border" />
                      <button onClick={() => removePhoto(idx)} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 shadow-md hover:scale-110 transition-transform">
                        <X className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                multiple
                className="hidden" 
                id="camera-input-multiple"
                onChange={handlePhotoChange}
              />
              <Label htmlFor="camera-input-multiple" className="cursor-pointer flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 py-6 hover:bg-primary/10 transition-colors">
                <Camera className="size-8 text-primary" />
                <span className="text-sm font-medium text-primary flex items-center gap-1"><Plus className="size-4"/> Adicionar Foto(s)</span>
              </Label>
            </div>
          </div>

          {/* ARQUIVO CHECKLIST */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-full bg-primary/20 text-primary text-xs">2</span>
              Arquivo de Checklist (Opcional)
            </Label>
            <div className="rounded-xl border border-dashed border-border/50 bg-muted/30 p-4 text-center transition-colors hover:bg-muted/50">
              <Input 
                type="file" 
                accept=".pdf,.doc,.docx" 
                className="hidden" 
                id="checklist-input-delivery"
                onChange={handleFileChange}
              />
              <Label htmlFor="checklist-input-delivery" className="cursor-pointer flex flex-col items-center gap-2">
                {checklistFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="size-8 text-primary" />
                    <span className="text-sm font-medium text-foreground break-all px-4">{checklistFile.name}</span>
                  </div>
                ) : (
                  <>
                    <FileUp className="size-8 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Anexar .PDF ou .WORD</span>
                  </>
                )}
              </Label>
              {checklistFile && (
                <Button variant="ghost" size="sm" className="mt-2 text-destructive" onClick={() => setChecklistFile(null)}>
                  Remover Arquivo
                </Button>
              )}
            </div>
          </div>

          {/* ASSINATURA MOTORISTA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-primary/20 text-primary text-xs">3</span>
                Assinatura do Motorista
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={handleClearSignatureDriver} className="h-8 text-xs text-muted-foreground">
                <Eraser className="size-3 mr-1" /> Limpar
              </Button>
            </div>
            <div className="rounded-xl border border-border/50 bg-white overflow-hidden shadow-inner">
              <SignatureCanvas 
                ref={sigDriverCanvas} 
                penColor="black"
                canvasProps={{ className: "w-full h-32 cursor-crosshair" }} 
              />
            </div>
          </div>

          {/* ASSINATURA ENFERMEIRA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-primary/20 text-primary text-xs">4</span>
                Assinatura do Hospital (Enfermeira/Recepção)
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={handleClearSignatureNurse} className="h-8 text-xs text-muted-foreground">
                <Eraser className="size-3 mr-1" /> Limpar
              </Button>
            </div>
            <div className="rounded-xl border border-border/50 bg-white overflow-hidden shadow-inner">
              <SignatureCanvas 
                ref={sigNurseCanvas} 
                penColor="black"
                canvasProps={{ className: "w-full h-32 cursor-crosshair" }} 
              />
            </div>
          </div>

        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 bg-muted/20">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!isFormValid()} className="shadow-sm shadow-primary/30">
            <Check className="size-4 mr-2" /> Salvar e Enviar para Verificação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
