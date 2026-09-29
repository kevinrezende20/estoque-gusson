import { format } from "date-fns";
import { CalendarClock, ChevronLeft, Plus, Truck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { DatePicker } from "@/components/hospital/date-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Hospital, Material, MaterialStatus, StockType } from "@/lib/hospital-data";

const statusStyles: Record<MaterialStatus, string> = {
  "Entregue": "border-transparent bg-accent/10 text-accent",
  "Em trânsito": "border-transparent bg-primary/10 text-primary",
  "Prazo próximo": "border-transparent bg-warning/10 text-warning",
  "Aguardando": "border-transparent bg-muted text-muted-foreground",
};

function MaterialsTable({ materials }: { materials: Material[] }) {
  return (
    <Table className="min-w-[720px]">
      <TableHeader><TableRow className="border-border hover:bg-transparent"><TableHead className="px-6 text-[11px] uppercase tracking-[0.1em]">Material</TableHead><TableHead className="px-6 text-[11px] uppercase tracking-[0.1em]">Caixas</TableHead><TableHead className="px-6 text-[11px] uppercase tracking-[0.1em]">Entrega</TableHead><TableHead className="px-6 text-[11px] uppercase tracking-[0.1em]">Retirada</TableHead><TableHead className="px-6 text-right text-[11px] uppercase tracking-[0.1em]">Status</TableHead></TableRow></TableHeader>
      <TableBody>
        {materials.map((material) => (
          <TableRow key={material.id} className="border-border hover:bg-card/50">
            <TableCell className="px-6 py-4 font-medium">{material.name}</TableCell>
            <TableCell className="px-6 py-4 font-display font-semibold">{material.boxes}</TableCell>
            <TableCell className="px-6 py-4 text-muted-foreground">{material.delivery}</TableCell>
            <TableCell className="px-6 py-4 text-muted-foreground">{material.pickup}</TableCell>
            <TableCell className="px-6 py-4 text-right"><Badge className={statusStyles[material.status]}>{material.status}</Badge></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type AddMaterialDialogProps = { stock: StockType; hospitalName: string; onAdd: (stock: StockType, material: Material) => void };

function AddMaterialDialog({ stock, hospitalName, onAdd }: AddMaterialDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [boxes, setBoxes] = useState("");
  const [delivery, setDelivery] = useState<Date>();
  const [pickup, setPickup] = useState<Date>();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !boxes || !delivery || !pickup) return;
    onAdd(stock, { id: Date.now(), name: name.trim(), boxes: Number(boxes), delivery: format(delivery, "dd/MM/yyyy"), pickup: format(pickup, "dd/MM/yyyy"), status: "Aguardando" });
    setName(""); setBoxes(""); setDelivery(undefined); setPickup(undefined); setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="h-10 rounded-xl shadow-sm shadow-primary/30"><Plus />Adicionar material</Button></DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl border-border bg-popover/95 p-0 backdrop-blur-xl sm:max-w-xl">
        <DialogHeader className="border-b border-border px-6 py-5 pr-14"><DialogTitle className="font-display text-xl">Adicionar material</DialogTitle><DialogDescription>{hospitalName} · Estoque {stock === "transitorio" ? "Transitório" : "Consignado"}</DialogDescription></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          <div className="space-y-2"><Label htmlFor={`material-${stock}`}>Nome do Material</Label><Input id={`material-${stock}`} required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Caixas de OPME, Implantes" className="h-11 rounded-xl bg-card" /></div>
          <div className="space-y-2"><Label htmlFor={`boxes-${stock}`}>Quantidade de Caixas</Label><Input id={`boxes-${stock}`} required min="1" type="number" value={boxes} onChange={(event) => setBoxes(event.target.value)} placeholder="0" className="h-11 rounded-xl bg-card" /></div>
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Data de Entrega</Label><DatePicker label="Data de entrega" value={delivery} onChange={setDelivery} /></div><div className="space-y-2"><Label>Data de Retirada</Label><DatePicker label="Data de retirada" value={pickup} onChange={setPickup} /></div></div>
          <DialogFooter className="gap-2 border-t border-border pt-5"><DialogClose asChild><Button type="button" variant="outline" className="rounded-xl">Cancelar</Button></DialogClose><Button type="submit" className="rounded-xl">Adicionar material</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function HospitalStock({ hospital }: { hospital: Hospital }) {
  const [stocks, setStocks] = useState({ transitorio: hospital.transitorio, consignado: hospital.consignado });
  const [activeStock, setActiveStock] = useState<StockType>("transitorio");
  const addMaterial = (stock: StockType, material: Material) => setStocks((current) => ({ ...current, [stock]: [...current[stock], material] }));

  return (
    <main className="page-enter mx-auto max-w-6xl space-y-7 px-4 py-6 sm:px-6 sm:py-8">
      <Link to="/" className="inline-flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-primary"><ChevronLeft className="size-4" />Voltar para locais</Link>
      <section className="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-7">
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4"><span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary/10 font-display text-lg font-bold text-primary">{hospital.initials}</span><div><div className="flex flex-wrap items-center gap-3"><h1 className="font-display text-2xl font-bold sm:text-[28px]">{hospital.name}</h1><Badge className="border-transparent bg-accent/10 text-accent"><span className="mr-1.5 size-1.5 rounded-full bg-accent" />Ativo</Badge></div><p className="mt-1 text-[13px] text-muted-foreground">{hospital.address}</p><p className="text-[13px] text-muted-foreground">{hospital.contact}</p></div></div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">{[
            { label: "Caixas ativas", value: hospital.activeBoxes, style: "text-foreground", icon: undefined },
            { label: "Em trânsito", value: hospital.inTransit, style: "text-primary", icon: Truck },
            { label: "Perto do prazo", value: hospital.nearDeadline, style: "text-warning", icon: CalendarClock },
          ].map((item) => <div key={item.label} className="glass-subtle min-w-0 rounded-2xl px-3 py-3 sm:min-w-[110px] sm:px-4"><p className="truncate text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground sm:text-[10px]">{item.label}</p><p className={`mt-0.5 font-display text-xl font-bold sm:text-2xl ${item.style}`}>{item.value}</p></div>)}</div>
        </div>
      </section>

      <Tabs value={activeStock} onValueChange={(value) => setActiveStock(value as StockType)}>
        <TabsList className="glass-subtle h-auto w-full justify-start overflow-x-auto rounded-2xl p-1.5 sm:w-fit"><TabsTrigger value="transitorio" className="h-10 rounded-xl px-5 text-[13px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Estoque Transitório</TabsTrigger><TabsTrigger value="consignado" className="h-10 rounded-xl px-5 text-[13px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Estoque Consignado</TabsTrigger></TabsList>
        {(["transitorio", "consignado"] as const).map((stock) => <TabsContent key={stock} value={stock} className="mt-5"><section className="glass-panel overflow-hidden rounded-3xl"><div className="flex flex-col items-start justify-between gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:px-6"><div><h2 className="font-display font-semibold">{stock === "transitorio" ? "Materiais em trânsito" : "Materiais consignados"}</h2><p className="text-xs text-muted-foreground">{stock === "transitorio" ? "OPME e insumos com prazo de entrega ou retirada" : "Materiais sob guarda do hospital e controle de consignação"}</p></div><AddMaterialDialog stock={stock} hospitalName={hospital.name} onAdd={addMaterial} /></div><MaterialsTable materials={stocks[stock]} /></section></TabsContent>)}
      </Tabs>
    </main>
  );
}
