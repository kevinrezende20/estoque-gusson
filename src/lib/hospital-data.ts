export type StockType = "transitorio" | "consignado";
export type MaterialStatus = "Entregue" | "Em trânsito" | "Prazo próximo" | "Aguardando";

export type Material = {
  id: number;
  name: string;
  boxes: number;
  delivery: string;
  pickup: string;
  status: MaterialStatus;
};

export type Hospital = {
  id: string;
  initials: string;
  name: string;
  city: string;
  address: string;
  contact: string;
  activeBoxes: number;
  inTransit: number;
  nearDeadline: number;
  transitorio: Material[];
  consignado: Material[];
};

export const hospitals: Hospital[] = [
  {
    id: "sao-lucas",
    initials: "SL",
    name: "Hospital São Lucas",
    city: "São Paulo, SP",
    address: "Rua das Acácias, 420 · Centro · São Paulo, SP",
    contact: "Direção de Suprimentos · (11) 4002-8800",
    activeBoxes: 148,
    inTransit: 12,
    nearDeadline: 6,
    transitorio: [
      { id: 1, name: "Caixas de OPME", boxes: 24, delivery: "12/05/2026", pickup: "18/05/2026", status: "Entregue" },
      { id: 2, name: "Implantes Ortopédicos", boxes: 8, delivery: "15/05/2026", pickup: "22/05/2026", status: "Em trânsito" },
      { id: 3, name: "Cateteres de Infusão", boxes: 40, delivery: "10/05/2026", pickup: "14/05/2026", status: "Prazo próximo" },
      { id: 4, name: "Materiais de Sutura", boxes: 15, delivery: "18/05/2026", pickup: "—", status: "Aguardando" },
    ],
    consignado: [
      { id: 5, name: "Próteses de Joelho", boxes: 18, delivery: "03/04/2026", pickup: "03/10/2026", status: "Entregue" },
      { id: 6, name: "Kits de Artroscopia", boxes: 11, delivery: "08/04/2026", pickup: "08/10/2026", status: "Entregue" },
    ],
  },
  {
    id: "santa-helena",
    initials: "SH",
    name: "Hospital Santa Helena",
    city: "Campinas, SP",
    address: "Av. Norte-Sul, 1180 · Cambuí · Campinas, SP",
    contact: "Central de Materiais · (19) 3255-4100",
    activeBoxes: 96,
    inTransit: 18,
    nearDeadline: 3,
    transitorio: [
      { id: 7, name: "Implantes de Coluna", boxes: 12, delivery: "20/05/2026", pickup: "28/05/2026", status: "Em trânsito" },
      { id: 8, name: "Kits Cirúrgicos", boxes: 28, delivery: "18/05/2026", pickup: "25/05/2026", status: "Aguardando" },
    ],
    consignado: [{ id: 9, name: "Placas e Parafusos", boxes: 31, delivery: "01/03/2026", pickup: "01/09/2026", status: "Entregue" }],
  },
  {
    id: "regional-do-vale",
    initials: "RV",
    name: "Hospital Regional do Vale",
    city: "São José dos Campos, SP",
    address: "Rua das Palmeiras, 95 · Jardim Satélite · São José dos Campos, SP",
    contact: "Almoxarifado Central · (12) 3901-2200",
    activeBoxes: 173,
    inTransit: 7,
    nearDeadline: 1,
    transitorio: [{ id: 10, name: "Caixas de Trauma", boxes: 16, delivery: "17/05/2026", pickup: "24/05/2026", status: "Entregue" }],
    consignado: [{ id: 11, name: "Próteses de Quadril", boxes: 22, delivery: "12/02/2026", pickup: "12/08/2026", status: "Prazo próximo" }],
  },
  {
    id: "nossa-senhora-das-gracas",
    initials: "NG",
    name: "Hospital N. Sra. das Graças",
    city: "Santos, SP",
    address: "Av. Conselheiro Nébias, 730 · Boqueirão · Santos, SP",
    contact: "Suprimentos Cirúrgicos · (13) 3202-1450",
    activeBoxes: 82,
    inTransit: 9,
    nearDeadline: 4,
    transitorio: [{ id: 12, name: "Kits de Hemodinâmica", boxes: 9, delivery: "21/05/2026", pickup: "27/05/2026", status: "Em trânsito" }],
    consignado: [{ id: 13, name: "Stents Coronários", boxes: 36, delivery: "10/03/2026", pickup: "10/09/2026", status: "Entregue" }],
  },
];

export function getHospital(id: string) {
  return hospitals.find((hospital) => hospital.id === id);
}
