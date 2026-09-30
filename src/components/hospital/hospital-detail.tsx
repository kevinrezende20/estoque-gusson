import { format } from "date-fns";
import { ChevronLeft, Plus, CheckCircle, Clock, AlertTriangle, Minus, XCircle, FileText, ArrowRight, Upload, Trash } from "lucide-react";
import { useState, type FormEvent, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { DatePicker } from "@/components/hospital/date-picker";
import { ChecklistSignatureDialog, type ChecklistSignatureResult } from "./ChecklistSignatureDialog";
import { MaterialDocumentsDialog } from "./MaterialDocumentsDialog";
import { DeliverySignatureDialog, type DeliverySignatureResult } from "./DeliverySignatureDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHospital, useMaterials, useHospitals, logAuditAction, uploadMaterialDocument, type DBMaterial, type DBHospital } from "@/lib/queries";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

const statusStyles: Record<string, string> = {
  "Entregue": "border-transparent bg-accent/10 text-accent",
  "Em trânsito": "border-transparent bg-primary/10 text-primary",
  "Prazo próximo": "border-transparent bg-warning/10 text-warning",
  "Aguardando": "border-transparent bg-muted text-muted-foreground",
};

function WithdrawMaterialDialog({ material, allHospitals, onWithdraw }: { material: DBMaterial; allHospitals: DBHospital[]; onWithdraw: (id: string, amount: number, reason: string, destId: string | null, comment: string) => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState<"estoque" | "hospital">("estoque");
  const [destId, setDestId] = useState("");
  const [comment, setComment] = useState("");
  const [showChecklist, setShowChecklist] = useState(false);
  const { user } = useAuth();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const num = Number(amount);
    if (num <= 0 || num > material.boxes) {
      alert("Quantidade inválida");
      return;
    }
    if (reason === "hospital" && !destId) {
      alert("Selecione o hospital de destino.");
      return;
    }
    // Em vez de chamar o onWithdraw direto, abrimos o checklist
    setOpen(false);
    setShowChecklist(true);
  };

  const handleChecklistSave = async (result: ChecklistSignatureResult) => {
    if (!user) return;

    // Fazer a retirada no banco primeiro
    onWithdraw(material.id, Number(amount), reason, reason === "hospital" ? destId : null, comment);

    // Depois subir a documentação
    if (result.photo) {
      await uploadMaterialDocument(material.id, user.id, 'foto', 'retirada', result.photo);
    }
    if (result.signature) {
      await uploadMaterialDocument(material.id, user.id, 'assinatura', 'retirada', result.signature);
    }
    if (result.checklistFiles && result.checklistFiles.length > 0) {
      for (const file of result.checklistFiles) {
        await uploadMaterialDocument(material.id, user.id, 'checklist', 'retirada', file);
      }
    }

    setShowChecklist(false);
    setAmount("");
    setReason("estoque");
    setDestId("");
    setComment("");
  };

  const otherHospitals = allHospitals.filter(h => h.id !== material.hospital_id);

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 rounded-lg text-[11px] text-muted-foreground hover:text-foreground">
          <Minus className="size-3 mr-1" />Retirar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-2xl border-border bg-popover/95 p-0 backdrop-blur-xl">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="font-display text-xl">Retirar Material</DialogTitle>
          <DialogDescription>De {material.name} (Máx: {material.boxes})</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Quantidade de Caixas</Label>
              <Input required type="number" min="1" max={material.boxes} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-11 rounded-xl bg-card" />
            </div>
            <div className="space-y-2">
              <Label>Destino</Label>
              <Select value={reason} onValueChange={(val: "estoque" | "hospital") => setReason(val)}>
                <SelectTrigger className="h-11 rounded-xl bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="estoque">Retornando ao Estoque</SelectItem>
                  <SelectItem value="hospital">Outro Hospital (Transferência)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {reason === "hospital" && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
              <Label>Hospital de Destino</Label>
              <Select value={destId} onValueChange={setDestId}>
                <SelectTrigger className="h-11 rounded-xl bg-card"><SelectValue placeholder="Selecione um hospital..." /></SelectTrigger>
                <SelectContent>
                  {otherHospitals.map(h => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Comentário / Observação (Opcional)</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Adicione alguma nota importante..." className="min-h-[80px] rounded-xl bg-card resize-none" />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <DialogClose asChild><Button type="button" variant="outline" className="rounded-xl">Cancelar</Button></DialogClose>
            <Button type="submit" className="rounded-xl">Confirmar Retirada</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <ChecklistSignatureDialog 
      open={showChecklist} 
      onOpenChange={setShowChecklist}
      requireChecklist={false}
      title="Documentação de Retirada"
      description="Adicione fotos e assinatura para auditar a saída deste material."
      onSave={handleChecklistSave}
    />
    </>
  );
}

function MaterialsTable({ materials, allHospitals, canApprove, onApprove, onWithdraw, onApproveWithdraw, onStandby, onDelete }: { 
  materials: DBMaterial[]; 
  allHospitals: DBHospital[];
  canApprove: boolean; 
  onApprove: (id: string) => void;
  onWithdraw: (id: string, amount: number, reason: string, destId: string | null, comment: string) => void;
  onApproveWithdraw: (id: string, approve: boolean) => void;
  onStandby: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [signatureMat, setSignatureMat] = useState<DBMaterial | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);

  const handleSignatureSave = async (result: DeliverySignatureResult) => {
    if (!signatureMat || !user) return;
    
    try {
      const type = 'entrega';
      for (const photo of result.photos) {
        await uploadMaterialDocument(signatureMat.id, user.id, 'foto', type, photo);
      }
      if (result.signatureDriver) {
        await uploadMaterialDocument(signatureMat.id, user.id, 'assinatura', type, result.signatureDriver);
      }
      if (result.signatureNurse) {
        await uploadMaterialDocument(signatureMat.id, user.id, 'assinatura', type, result.signatureNurse); 
      }
      if (result.checklistFiles && result.checklistFiles.length > 0) {
        for (const file of result.checklistFiles) {
          await uploadMaterialDocument(signatureMat.id, user.id, 'checklist', type, file);
        }
      }

      // Always change to 'Pendente de verificação' so Admin reviews it
      const { error } = await supabase.from('materials').update({ status: 'Pendente de verificação' }).eq('id', signatureMat.id);
      if (error) throw error;

      logAuditAction(user.id, signatureMat.hospital_id, signatureMat.name, `Anexo de Documentos (${signatureMat.status === 'Em trânsito' ? 'Confirmação de Entrega' : 'Documentação Extra'})`, { boxes: signatureMat.boxes });
      queryClient.invalidateQueries({ queryKey: ['materials'] });

      // Fechar modal apenas no sucesso
      setSignatureOpen(false);
      setSignatureMat(null);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao enviar documentos: " + err.message);
    }
  };

  if (materials.length === 0) {
    return <div className="px-6 py-10 text-center text-sm text-muted-foreground">Nenhum material cadastrado nesta seção.</div>;
  }
  return (
    <>
    <Table className="min-w-[720px]">
      <TableHeader>
        <TableRow className="border-border hover:bg-transparent">
          <TableHead className="px-6 text-[11px] uppercase tracking-[0.1em]">Material / Detalhes</TableHead>
          <TableHead className="px-6 text-[11px] uppercase tracking-[0.1em]">Caixas</TableHead>
          <TableHead className="px-6 text-[11px] uppercase tracking-[0.1em]">Entrega</TableHead>
          <TableHead className="px-6 text-[11px] uppercase tracking-[0.1em]">Retirada</TableHead>
          <TableHead className="px-6 text-right text-[11px] uppercase tracking-[0.1em]">Status / Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {materials.map((material) => {
          const isPendingAdd = !material.is_approved;
          const isPendingWithdraw = material.pending_withdrawal_boxes > 0;
          const isStandby = material.status === 'Standby';
          const destHospital = material.pending_withdrawal_hospital_id ? allHospitals.find(h => h.id === material.pending_withdrawal_hospital_id)?.name : null;

          return (
            <TableRow key={material.id} className={`border-border hover:bg-card/50 ${isPendingAdd ? 'opacity-70 bg-warning/5' : ''}`}>
              <TableCell className="px-6 py-4 font-medium max-w-[280px]">
                <div className="flex flex-col gap-1.5">
                  <span className="truncate">{material.name}</span>
                  
                  {isPendingAdd && (
                    <Badge className="w-fit border-transparent bg-warning/15 text-warning text-[10px]">
                      <Clock className="size-3 mr-1" />Nova Entrada Pendente
                    </Badge>
                  )}

                  {isPendingWithdraw && (
                    <div className="mt-1 flex flex-col gap-1.5 border-l-2 border-destructive/30 pl-2">
                      <Badge className="w-fit border-transparent bg-destructive/15 text-destructive text-[10px]">
                        <Minus className="size-3 mr-1" />Saída Pendente: {material.pending_withdrawal_boxes} cxs
                      </Badge>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <ArrowRight className="size-3" />
                        <span>{material.pending_withdrawal_reason === 'hospital' ? `Transferência: ${destHospital || 'Outro Hospital'}` : 'Retorno ao Estoque'}</span>
                      </div>
                      {material.pending_withdrawal_comment && (
                        <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground/80 italic">
                          <FileText className="size-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">"{material.pending_withdrawal_comment}"</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="px-6 py-4 font-display font-semibold align-top">{material.boxes}</TableCell>
              <TableCell className="px-6 py-4 text-muted-foreground align-top">{material.delivery || '—'}</TableCell>
              <TableCell className="px-6 py-4 text-muted-foreground align-top">{material.pickup || '—'}</TableCell>
              <TableCell className="px-6 py-4 text-right align-top">
                <div className="flex flex-col items-end gap-2">
                  <Badge className={statusStyles[material.status] || statusStyles["Aguardando"]}>{material.status}</Badge>
                  
                  {isStandby && (
                    <Badge className="bg-orange-500/15 text-orange-600 border-orange-500/30">Em Standby</Badge>
                  )}
                  
                  <div className="flex flex-col items-end gap-2 mt-2">
                    {isPendingAdd && canApprove && (
                      <div className="flex flex-col gap-2">
                        <Button size="sm" variant="outline" className="h-7 w-full justify-start rounded-lg border-accent/30 text-accent hover:bg-accent/10 text-[11px]" onClick={() => onApprove(material.id)}>
                          <CheckCircle className="size-3 mr-1.5" />Aprovar Entrada
                        </Button>
                        {!isStandby && (
                          <Button size="sm" variant="outline" className="h-7 w-full justify-start rounded-lg border-orange-500/30 text-orange-600 hover:bg-orange-500/10 text-[11px]" onClick={() => onStandby(material.id)}>
                            <AlertCircle className="size-3 mr-1.5" />Standby
                          </Button>
                        )}
                      </div>
                    )}

                    {isPendingWithdraw && canApprove && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-7 rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10 text-[11px]" onClick={() => onApproveWithdraw(material.id, false)}>
                            <XCircle className="size-3 mr-1" />Rejeitar
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 rounded-lg border-accent/30 text-accent hover:bg-accent/10 text-[11px]" onClick={() => onApproveWithdraw(material.id, true)}>
                            <CheckCircle className="size-3 mr-1" />Aprovar Saída
                          </Button>
                        </div>
                        {!isStandby && (
                          <Button size="sm" variant="outline" className="h-7 w-full justify-start rounded-lg border-orange-500/30 text-orange-600 hover:bg-orange-500/10 text-[11px]" onClick={() => onStandby(material.id)}>
                            <AlertCircle className="size-3 mr-1.5" />Colocar em Standby
                          </Button>
                        )}
                      </div>
                    )}

                    {!isPendingAdd && !isPendingWithdraw && (
                      <div className="flex flex-col items-end gap-2">
                        {material.status === 'Em trânsito' && (
                          <Button size="sm" variant="default" className="h-7 rounded-lg text-[11px] bg-blue-600 hover:bg-blue-700" onClick={() => { setSignatureMat(material); setSignatureOpen(true); }}>
                            <Upload className="size-3 mr-1" />Confirmar Entrega
                          </Button>
                        )}
                        {material.status === 'Entregue' && (
                          <Button size="sm" variant="outline" className="h-7 rounded-lg text-[11px]" onClick={() => { setSignatureMat(material); setSignatureOpen(true); }}>
                            <Upload className="size-3 mr-1" />Anexar Documentos
                          </Button>
                        )}
                        <div className="flex items-center gap-2">
                          <MaterialDocumentsDialog materialId={material.id} materialName={material.name} />
                          <WithdrawMaterialDialog material={material} allHospitals={allHospitals} onWithdraw={onWithdraw} />
                          {role === 'Admin' && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => onDelete(material.id)}>
                              <Trash className="size-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
    {signatureMat && (
      <DeliverySignatureDialog
        open={signatureOpen}
        onOpenChange={setSignatureOpen}
        title={signatureMat.status === 'Em trânsito' ? 'Documentação de Entrega' : 'Anexar Documentos'}
        description={`Adicione fotos, assinaturas e checklists para o material ${signatureMat.name}.`}
        onSave={handleSignatureSave}
      />
    )}
    </>
  );
}

type AddMaterialDialogProps = {
  hospitalId: string;
  hospitalName: string;
  section: "CME" | "OPME";
  stockType: "transitorio" | "consignado";
  userRole: string | null;
};

function AddMaterialDialog({ hospitalId, hospitalName, section, stockType, userRole }: AddMaterialDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [boxes, setBoxes] = useState("");
  const [status, setStatus] = useState("Aguardando");
  const [delivery, setDelivery] = useState<Date>();
  const [pickup, setPickup] = useState<Date>();
  const [checklistFiles, setChecklistFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const isMotorista = userRole === "Motorista";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !boxes || !user) return;
    
    setSaving(true);
    
    try {
      const { data, error } = await supabase.from('materials').insert([{
        hospital_id: hospitalId,
        section,
        stock_type: stockType,
        name: name.trim(),
        boxes: Number(boxes),
        delivery: delivery ? format(delivery, "dd/MM/yyyy") : null,
        pickup: pickup ? format(pickup, "dd/MM/yyyy") : null,
        status,
        is_approved: !isMotorista,
        created_by: user.id,
        pending_withdrawal_boxes: 0
      }]).select().single();
      
      if (error) throw error;
      
      logAuditAction(user.id, hospitalId, name.trim(), 'Adição de Material', { material_id: data.id, boxes: Number(boxes), section, stockType });

      if (checklistFiles.length > 0) {
        for (const file of checklistFiles) {
          await uploadMaterialDocument(data.id, user.id, 'checklist', 'entrega', file);
        }
      }
      
      setOpen(false);
      setName(""); setBoxes(""); setStatus("Aguardando"); setDelivery(undefined); setPickup(undefined); setChecklistFiles([]);
      queryClient.invalidateQueries({ queryKey: ['materials', hospitalId] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      
    } catch (err) {
      console.error(err);
      alert("Erro ao adicionar material e salvar documentos.");
    } finally {
      setSaving(false);
    }
  }

  const stockLabel = stockType === "transitorio" ? "Transitório" : "Consignado";

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-10 rounded-xl shadow-sm shadow-primary/30"><Plus className="size-4 mr-1" />Adicionar material</Button></DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl border-border bg-popover/95 p-0 backdrop-blur-xl sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle className="font-display text-xl">Adicionar material</DialogTitle>
          <DialogDescription>{hospitalName} · {section} · {stockLabel}</DialogDescription>
        </DialogHeader>
        {isMotorista && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>Sua adição ficará <strong>pendente</strong> até ser aprovada por um administrador ou membro do estoque.</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          <div className="space-y-2"><Label htmlFor={`mat-name-${section}-${stockType}`}>Nome do Material</Label><Input id={`mat-name-${section}-${stockType}`} required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Caixas de OPME, Implantes" className="h-11 rounded-xl bg-card" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor={`mat-boxes-${section}-${stockType}`}>Qtd. de Caixas</Label><Input id={`mat-boxes-${section}-${stockType}`} required min="1" type="number" value={boxes} onChange={(e) => setBoxes(e.target.value)} placeholder="0" className="h-11 rounded-xl bg-card" /></div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-11 rounded-xl bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Aguardando">Aguardando</SelectItem>
                  <SelectItem value="Em trânsito">Em trânsito</SelectItem>
                  <SelectItem value="Entregue">Entregue</SelectItem>
                  <SelectItem value="Prazo próximo">Prazo próximo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Data de Entrega</Label><DatePicker label="Data de entrega" value={delivery} onChange={setDelivery} /></div>
            <div className="space-y-2"><Label>Data de Retirada</Label><DatePicker label="Data de retirada" value={pickup} onChange={setPickup} /></div>
          </div>
          
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><FileText className="size-4" /> Checklists (Opcional)</Label>
            <div className="space-y-2">
              <Input 
                type="file" 
                multiple
                accept="image/*,.pdf,.doc,.docx" 
                onChange={(e) => {
                  if (e.target.files) {
                    setChecklistFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                  }
                }}
                className="h-11 rounded-xl bg-card text-xs cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              {checklistFiles.length > 0 && (
                <div className="flex flex-col gap-2 mt-2">
                  {checklistFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-lg text-sm">
                      <span className="truncate max-w-[200px]">{file.name}</span>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setChecklistFiles(prev => prev.filter((_, i) => i !== idx))} className="shrink-0 text-destructive size-7">
                        <XCircle className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-border pt-5">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="rounded-xl">{saving ? "Salvando..." : "Adicionar material"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}

function StockSection({ hospitalId, hospitalName, section, stockType, materials, allHospitals, canApprove, userRole, onApprove, onWithdraw, onApproveWithdraw, onStandby, onDelete }: {
  hospitalId: string; hospitalName: string; section: "CME" | "OPME"; stockType: "transitorio" | "consignado"; materials: DBMaterial[]; allHospitals: DBHospital[]; canApprove: boolean; userRole: string | null; onApprove: (id: string) => void; onWithdraw: (id: string, amount: number, reason: string, destId: string | null, comment: string) => void; onApproveWithdraw: (id: string, approve: boolean) => void; onStandby: (id: string) => void; onDelete: (id: string) => void;
}) {
  const stockLabel = stockType === "transitorio" ? "Transitório" : "Consignado";
  const pendingAddCount = materials.filter(m => !m.is_approved).length;
  const pendingWithdrawCount = materials.filter(m => m.pending_withdrawal_boxes > 0).length;
  const pendingCount = pendingAddCount + pendingWithdrawCount;

  return (
    <section className="glass-panel overflow-hidden rounded-3xl">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <div>
          <h3 className="font-display font-semibold">Estoque {stockLabel}</h3>
          <p className="text-xs text-muted-foreground">{materials.length} materiais{pendingCount > 0 ? ` · ${pendingCount} pendente(s)` : ''}</p>
        </div>
        <AddMaterialDialog hospitalId={hospitalId} hospitalName={hospitalName} section={section} stockType={stockType} userRole={userRole} />
      </div>
      <MaterialsTable materials={materials} allHospitals={allHospitals} canApprove={canApprove} onApprove={onApprove} onWithdraw={onWithdraw} onApproveWithdraw={onApproveWithdraw} onStandby={onStandby} onDelete={onDelete} />
    </section>
  );
}

export function HospitalDetail({ hospitalId }: { hospitalId: string }) {
  const { data: hospital, isLoading: loadingHospital } = useHospital(hospitalId);
  const { data: allHospitals = [] } = useHospitals();
  const { data: allMaterials = [], isLoading: loadingMaterials } = useMaterials(hospitalId);
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<"CME" | "OPME">("CME");
  const [standbyMaterialId, setStandbyMaterialId] = useState<string | null>(null);
  const [standbyComment, setStandbyComment] = useState("");
  const [deleteMaterialId, setDeleteMaterialId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleStandby = async () => {
    if (!standbyMaterialId) return;
    if (!standbyComment.trim()) {
      alert("Por favor, adicione um comentário sobre o problema.");
      return;
    }
    const material = allMaterials.find(m => m.id === standbyMaterialId);
    if (!material) return;

    const { error } = await supabase.from('materials').update({ 
      status: 'Standby',
      pending_withdrawal_comment: standbyComment.trim()
    }).eq('id', standbyMaterialId);

    if (error) {
      alert("Erro ao colocar em Standby: " + error.message);
    } else {
      if (user) logAuditAction(user.id, material.hospital_id, material.name, 'Enviado para Standby (Detalhes)', { comment: standbyComment.trim() });
      setStandbyMaterialId(null);
      setStandbyComment("");
      queryClient.invalidateQueries({ queryKey: ['materials', hospitalId] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    }
  };

  const canApprove = ['Admin', 'Estoque', 'Conferente'].includes(role || '');
  const isMotorista = role === "Motorista";

  const handleDeleteClick = (materialId: string) => {
    setDeleteMaterialId(materialId);
  };

  const handleConfirmDelete = async () => {
    if (role !== 'Admin' || !deleteMaterialId) return;
    
    setIsDeleting(true);
    try {
      console.log("Tentando excluir material:", deleteMaterialId);
      const material = allMaterials.find(m => m.id === deleteMaterialId);
      
      const { data, error } = await supabase.from('materials').delete().eq('id', deleteMaterialId).select();
      console.log("Resultado da exclusão:", { data, error });
      
      if (error) {
        alert("Erro ao excluir: " + error.message);
      } else if (!data || data.length === 0) {
        alert("Nenhum material foi excluído. Isso pode ocorrer se a política de segurança (RLS) não foi configurada corretamente no Supabase. O banco não permitiu a exclusão.");
      } else {
        if (user && material) logAuditAction(user.id, hospitalId, material.name, 'Exclusão de Material (Admin)', { boxes: material.boxes });
        queryClient.invalidateQueries({ queryKey: ['materials', hospitalId] });
        queryClient.invalidateQueries({ queryKey: ['materials'] });
        
        setDeleteMaterialId(null);
        alert("Material excluído com sucesso!");
      }
    } catch (err: any) {
      console.error("Exceção capturada no handleConfirmDelete:", err);
      alert("Ocorreu um erro inesperado: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleApprove = async (materialId: string) => {
    const material = allMaterials.find(m => m.id === materialId);
    const { error } = await supabase.from('materials').update({ is_approved: true }).eq('id', materialId);
    if (!error) {
      if (user && material) logAuditAction(user.id, hospitalId, material.name, 'Aprovação de Entrada', { material_id: materialId, boxes: material.boxes });
      queryClient.invalidateQueries({ queryKey: ['materials', hospitalId] });
    }
  };

  const processTransfer = async (material: DBMaterial, amount: number, destId: string | null) => {
    if (destId) {
      const { error } = await supabase.from('materials').insert([{
        hospital_id: destId,
        section: material.section,
        stock_type: material.stock_type,
        name: material.name,
        boxes: amount,
        status: 'Aguardando',
        is_approved: false,
        created_by: user?.id || null,
        pending_withdrawal_boxes: 0
      }]);
      if (error) {
        console.error("Erro na transferência:", error);
        alert("Erro ao transferir material para o outro hospital: " + error.message);
      } else {
        if (user) logAuditAction(user.id, destId, material.name, 'Entrada por Transferência (Pendente)', { boxes: amount, sourceHospitalId: material.hospital_id });
      }
    }
  };

  const handleWithdrawRequest = async (materialId: string, amount: number, reason: string, destId: string | null, comment: string) => {
    if (isMotorista) {
      const { error } = await supabase.from('materials').update({ 
        pending_withdrawal_boxes: amount,
        pending_withdrawal_reason: reason,
        pending_withdrawal_hospital_id: destId,
        pending_withdrawal_comment: comment
      }).eq('id', materialId);
      
      if (error) {
        console.error("Erro do Motorista:", error);
        alert("Erro ao solicitar retirada: " + error.message);
      } else {
        const material = allMaterials.find(m => m.id === materialId);
        if (user && material) logAuditAction(user.id, hospitalId, material.name, 'Solicitação de Retirada', { material_id: materialId, boxes: amount, reason, destId, comment });
        queryClient.invalidateQueries({ queryKey: ['materials', hospitalId] });
      }
    } else {
      // Direct withdrawal for Admin/Estoque
      const material = allMaterials.find(m => m.id === materialId);
      if (!material) return;
      const newBoxes = material.boxes - amount;
      
      let updateError = null;
      if (newBoxes <= 0) {
        const { error } = await supabase.from('materials').delete().eq('id', materialId);
        updateError = error;
      } else {
        const { error } = await supabase.from('materials').update({ boxes: newBoxes }).eq('id', materialId);
        updateError = error;
      }

      if (updateError) {
        console.error("Erro do Admin:", updateError);
        alert("Erro ao retirar material: " + updateError.message);
        return;
      }

      if (user) logAuditAction(user.id, hospitalId, material.name, 'Retirada Direta', { material_id: materialId, boxes: amount, reason, destId, comment });

      if (reason === 'hospital') {
        await processTransfer(material, amount, destId);
      }

      queryClient.invalidateQueries({ queryKey: ['materials', hospitalId] });
    }
  };

  const handleApproveWithdraw = async (materialId: string, approve: boolean) => {
    const material = allMaterials.find(m => m.id === materialId);
    if (!material) return;
    
    if (approve) {
      const newBoxes = material.boxes - material.pending_withdrawal_boxes;
      let updateError = null;

      if (newBoxes <= 0) {
        const { error } = await supabase.from('materials').delete().eq('id', materialId);
        updateError = error;
      } else {
        const { error } = await supabase.from('materials').update({ 
          boxes: newBoxes, 
          pending_withdrawal_boxes: 0,
          pending_withdrawal_reason: null,
          pending_withdrawal_hospital_id: null,
          pending_withdrawal_comment: null
        }).eq('id', materialId);
        updateError = error;
      }

      if (updateError) {
        alert("Erro ao aprovar: " + updateError.message);
        return;
      }

      if (user) logAuditAction(user.id, hospitalId, material.name, 'Aprovação de Saída', { boxes: material.pending_withdrawal_boxes });

      if (material.pending_withdrawal_reason === 'hospital') {
        await processTransfer(material, material.pending_withdrawal_boxes, material.pending_withdrawal_hospital_id || null);
      }
    } else {
      const { error } = await supabase.from('materials').update({ 
        pending_withdrawal_boxes: 0,
        pending_withdrawal_reason: null,
        pending_withdrawal_hospital_id: null,
        pending_withdrawal_comment: null
      }).eq('id', materialId);
      if (error) {
        alert("Erro ao rejeitar: " + error.message);
        return;
      }
      if (user) logAuditAction(user.id, hospitalId, material.name, 'Rejeição de Saída', { boxes: material.pending_withdrawal_boxes });
    }
    queryClient.invalidateQueries({ queryKey: ['materials', hospitalId] });
  };

  const sectionMaterials = useMemo(() => {
    return allMaterials.filter(m => m.section === activeSection);
  }, [allMaterials, activeSection]);

  const transitorio = useMemo(() => sectionMaterials.filter(m => m.stock_type === 'transitorio'), [sectionMaterials]);
  const consignado = useMemo(() => sectionMaterials.filter(m => m.stock_type === 'consignado'), [sectionMaterials]);

  if (loadingHospital || loadingMaterials) {
    return (
      <main className="page-enter mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>
      </main>
    );
  }

  if (!hospital) {
    return (
      <main className="page-enter mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"><ChevronLeft className="size-4" />Voltar para locais</Link>
        <div className="flex items-center justify-center py-20 text-muted-foreground">Hospital não encontrado.</div>
      </main>
    );
  }

  const approvedMats = allMaterials.filter(m => m.is_approved);
  const totalBoxes = approvedMats.reduce((sum, m) => sum + m.boxes, 0);
  const totalPending = allMaterials.filter(m => !m.is_approved || m.pending_withdrawal_boxes > 0).length;

  return (
    <>
    <main className="page-enter mx-auto max-w-6xl space-y-7 px-4 py-6 sm:px-6 sm:py-8">
      <Link to="/" className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"><ChevronLeft className="size-4" />Voltar para locais</Link>

      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-7">
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 font-display text-lg font-bold text-primary">{hospital.name.substring(0, 2).toUpperCase()}</span>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-2xl font-bold sm:text-[28px]">{hospital.name}</h1>
                <Badge className="border-transparent bg-accent/10 text-accent"><span className="mr-1.5 size-1.5 rounded-full bg-accent" />Ativo</Badge>
              </div>
              <p className="mt-1 text-[13px] text-muted-foreground">{hospital.city}</p>
              {hospital.contact && <p className="text-[13px] text-muted-foreground">{hospital.contact}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="glass-subtle min-w-0 rounded-2xl px-3 py-3 sm:min-w-[110px] sm:px-4">
              <p className="truncate text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground sm:text-[10px]">Total de Caixas</p>
              <p className="mt-0.5 font-display text-xl font-bold sm:text-2xl text-foreground">{totalBoxes}</p>
            </div>
            <div className="glass-subtle min-w-0 rounded-2xl px-3 py-3 sm:min-w-[110px] sm:px-4">
              <p className="truncate text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground sm:text-[10px]">Total Materiais</p>
              <p className="mt-0.5 font-display text-xl font-bold sm:text-2xl text-primary">{approvedMats.length}</p>
            </div>
            <div className="glass-subtle min-w-0 rounded-2xl px-3 py-3 sm:min-w-[110px] sm:px-4">
              <p className="truncate text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground sm:text-[10px]">Pendentes</p>
              <p className={`mt-0.5 font-display text-xl font-bold sm:text-2xl ${totalPending > 0 ? 'text-warning' : 'text-foreground'}`}>{totalPending}</p>
            </div>
          </div>
        </div>
      </section>

      <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as "CME" | "OPME")}>
        <TabsList className="glass-subtle h-auto w-full justify-start overflow-x-auto rounded-2xl p-1.5 sm:w-fit">
          <TabsTrigger value="CME" className="h-10 rounded-xl px-5 text-[13px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">CME</TabsTrigger>
          <TabsTrigger value="OPME" className="h-10 rounded-xl px-5 text-[13px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">OPME</TabsTrigger>
        </TabsList>

        {(["CME", "OPME"] as const).map((sec) => {
          const deliveryTime = sec === "CME" ? hospital.cme_delivery_time : hospital.opme_delivery_time;
          const pickupTime = sec === "CME" ? hospital.cme_pickup_time : hospital.opme_pickup_time;
          const hasSchedule = deliveryTime || pickupTime;

          return (
            <TabsContent key={sec} value={sec} className="mt-5 space-y-5">
              {hasSchedule && (
                <div className="glass-subtle flex flex-col sm:flex-row gap-4 sm:gap-8 rounded-2xl p-4 sm:px-6">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Clock className="size-5" />
                    <span>Horários {sec}</span>
                  </div>
                  <div className="flex flex-wrap gap-6">
                    {deliveryTime && (
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Entrega</p>
                        <p className="font-medium text-foreground">{deliveryTime}</p>
                      </div>
                    )}
                    {pickupTime && (
                      <div>
                        <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">Retirada</p>
                        <p className="font-medium text-foreground">{pickupTime}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <StockSection
              hospitalId={hospitalId}
              hospitalName={hospital.name}
              section={sec}
              stockType="transitorio"
              materials={sec === activeSection ? transitorio : []}
              allHospitals={allHospitals}
              canApprove={canApprove}
              userRole={role}
              onApprove={handleApprove}
              onWithdraw={handleWithdrawRequest}
              onApproveWithdraw={handleApproveWithdraw}
              onStandby={setStandbyMaterialId}
              onDelete={handleDeleteClick}
            />
            <StockSection
              hospitalId={hospitalId}
              hospitalName={hospital.name}
              section={sec}
              stockType="consignado"
              materials={sec === activeSection ? consignado : []}
              allHospitals={allHospitals}
              canApprove={canApprove}
              userRole={role}
              onApprove={handleApprove}
              onWithdraw={handleWithdrawRequest}
              onApproveWithdraw={handleApproveWithdraw}
              onStandby={setStandbyMaterialId}
              onDelete={handleDeleteClick}
            />
          </TabsContent>
          );
        })}
      </Tabs>

      <Dialog open={!!standbyMaterialId} onOpenChange={(open) => !open && setStandbyMaterialId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mover para Standby</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Motivo / Problema encontrado</Label>
              <Textarea 
                placeholder="Ex: Faltando peça X, caixa quebrada..." 
                value={standbyComment}
                onChange={e => setStandbyComment(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStandbyMaterialId(null)}>Cancelar</Button>
              <Button className="bg-orange-600 hover:bg-orange-700" onClick={handleStandby}>Confirmar Standby</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>

    <Dialog open={!!deleteMaterialId} onOpenChange={(open) => !open && !isDeleting && setDeleteMaterialId(null)}>
      <DialogContent className="sm:max-w-md rounded-2xl border-border bg-popover/95 p-6 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="font-display">Tem certeza absoluta?</DialogTitle>
          <DialogDescription>
            Essa ação não pode ser desfeita. Isso excluirá permanentemente o material selecionado do sistema.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => setDeleteMaterialId(null)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button variant="destructive" className="rounded-xl" onClick={handleConfirmDelete} disabled={isDeleting}>
            {isDeleting ? "Excluindo..." : "Sim, excluir material"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
