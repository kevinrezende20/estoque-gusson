import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMaterialDocuments } from "@/lib/queries";
import { FileText, Image as ImageIcon, PenTool, CheckSquare, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { exportMaterialReceiptAsPdf } from "@/lib/pdf-generator";

export function MaterialDocumentsDialog({ materialId, materialName }: { materialId: string, materialName: string }) {
  const { data: documents = [], isLoading } = useMaterialDocuments(materialId);

  const handleExport = () => {
    if (documents.length > 0) {
      exportMaterialReceiptAsPdf(materialName, documents);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 rounded-lg text-[11px] text-muted-foreground hover:text-foreground">
          <FileText className="size-3 mr-1" />Docs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl border-border bg-popover/95 p-0 backdrop-blur-xl sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-5 flex flex-row items-start justify-between">
          <div>
            <DialogTitle className="font-display text-xl">Documentação</DialogTitle>
            <DialogDescription>{materialName}</DialogDescription>
          </div>
          {documents.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleExport} className="h-8 gap-1.5 text-primary">
              <Download className="size-3.5" /> Baixar Recibo (PDF)
            </Button>
          )}
        </DialogHeader>

        <div className="space-y-6 px-6 py-5">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando documentos...</p>
          ) : documents.length === 0 ? (
            <div className="py-10 text-center">
              <FileText className="size-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma documentação anexada a este material.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {documents.map(doc => (
                <div key={doc.id} className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-border/50 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                        {doc.action_context}
                      </span>
                      <span className="text-sm font-semibold flex items-center gap-1.5">
                        {doc.document_type === "foto" && <><ImageIcon className="size-4" /> Fotografia</>}
                        {doc.document_type === "assinatura" && <><PenTool className="size-4" /> Assinatura</>}
                        {doc.document_type === "checklist" && <><FileText className="size-4" /> Checklist Anexado</>}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{format(parseISO(doc.created_at), "dd/MM/yyyy HH:mm")}</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-5">
                    {doc.document_type === 'checklist' ? (
                      <div className="flex-1 rounded-lg border border-border/50 bg-white p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <FileText className="size-8 text-primary" />
                          <div>
                            <p className="text-sm font-medium">Arquivo de Checklist</p>
                            <p className="text-xs text-muted-foreground">Documento anexado pelo usuário</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <a href={doc.file_url} target="_blank" rel="noopener noreferrer">Baixar / Ver</a>
                        </Button>
                      </div>
                    ) : (
                      <div className="shrink-0 rounded-lg overflow-hidden border border-border/50 bg-white">
                        <img 
                          src={doc.file_url} 
                          alt={doc.document_type} 
                          className={doc.document_type === "foto" ? "h-32 w-40 object-cover" : "h-32 w-40 object-contain p-2"} 
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
