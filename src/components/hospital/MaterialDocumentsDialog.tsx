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
              {Object.entries(
                documents.reduce((acc, doc) => {
                  const ctx = doc.action_context || 'Outros';
                  if (!acc[ctx]) acc[ctx] = [];
                  acc[ctx].push(doc);
                  return acc;
                }, {} as Record<string, typeof documents>)
              ).map(([context, docs]) => {
                const photos = docs.filter(d => d.document_type === 'foto');
                const signatures = docs.filter(d => d.document_type === 'assinatura');
                const checklists = docs.filter(d => d.document_type === 'checklist');

                return (
                  <div key={context} className="rounded-xl border border-border/50 bg-card overflow-hidden">
                    <div className="bg-muted/30 px-4 py-3 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-muted text-muted-foreground w-fit">
                        {context}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        {format(parseISO(docs[0].created_at), "dd/MM/yyyy 'às' HH:mm")}
                      </span>
                    </div>

                    <div className="p-5 space-y-6">
                      {photos.length > 0 && (
                        <div>
                          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                            <ImageIcon className="size-3.5" /> Fotografias
                          </h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {photos.map(p => (
                              <a key={p.id} href={p.file_url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border/50 aspect-square group bg-black">
                                <img src={p.file_url} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300" alt="Foto anexada" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {signatures.length > 0 && (
                        <div>
                          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                            <PenTool className="size-3.5" /> Assinaturas
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {signatures.map(s => (
                              <div key={s.id} className="rounded-lg border border-border/50 bg-white p-3 flex items-center justify-center h-28 relative group">
                                <img src={s.file_url} className="max-w-full max-h-full object-contain" alt="Assinatura" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {checklists.length > 0 && (
                        <div>
                          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                            <FileText className="size-3.5" /> Checklists Anexados
                          </h4>
                          <div className="space-y-2">
                            {checklists.map(c => (
                              <div key={c.id} className="flex flex-row items-center justify-between p-3 rounded-lg border border-border/50 bg-white hover:bg-muted/20 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className="p-2 bg-primary/10 rounded-md shrink-0">
                                    <FileText className="size-4 text-primary" />
                                  </div>
                                  <div className="truncate">
                                    <p className="text-sm font-medium truncate">Documento de Checklist</p>
                                  </div>
                                </div>
                                <Button size="sm" variant="outline" className="h-7 shrink-0 ml-3" asChild>
                                  <a href={c.file_url} target="_blank" rel="noopener noreferrer">Baixar / Ver</a>
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
