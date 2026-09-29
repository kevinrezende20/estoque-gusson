import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';

// 1. Relatório Global (Tabela)
export function exportGlobalReportAsPdf(logs: any[], hospitals: any[]) {
  const doc = new jsPDF();
  
  // Cabeçalho
  doc.setFontSize(20);
  doc.text('Relatório de Alterações - Controle Gusson', 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")}`, 14, 30);
  
  // Tabela
  const tableData = logs.map(log => {
    const hospital = hospitals.find((h: any) => h.id === log.hospital_id);
    const date = log.created_at ? format(parseISO(log.created_at), "dd/MM/yyyy HH:mm") : 'N/A';
    
    // Tratando action details
    let detailsStr = '';
    if (log.action === 'Retirada de Material' && log.details) {
      detailsStr = `${log.details.boxes} cx(s) -> ${log.details.reason === 'hospital' ? 'Outro Hospital' : 'Estoque'}`;
    } else if (log.action === 'Aprovação de Material' || log.action === 'Adição de Material') {
      detailsStr = log.details?.boxes ? `${log.details.boxes} cx(s)` : '-';
    }
    
    return [
      date,
      hospital?.name || 'Desconhecido',
      log.material_name || '-',
      log.action,
      log.user_email?.split('@')[0] || 'Sistema',
      detailsStr
    ];
  });

  autoTable(doc, {
    startY: 38,
    head: [['Data/Hora', 'Hospital', 'Material', 'Ação', 'Usuário', 'Detalhes']],
    body: tableData,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 23, 42] }, // Slate 900
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(`Relatorio_Gusson_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}

// 2. Recibo Individual (MaterialDocumentsDialog)
export async function exportMaterialReceiptAsPdf(materialName: string, documents: any[]) {
  const doc = new jsPDF();
  
  // Cabeçalho
  doc.setFontSize(18);
  doc.text('Recibo de Documentação de Material', 14, 20);
  
  doc.setFontSize(12);
  doc.setTextColor(80);
  doc.text(`Material: ${materialName}`, 14, 28);
  doc.text(`Data de Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 34);
  
  doc.setLineWidth(0.5);
  doc.line(14, 38, 196, 38);

  let currentY = 45;

  for (const docItem of documents) {
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(`Ação: ${docItem.action_context.toUpperCase()}`, 14, currentY);
    doc.text(`Data: ${format(parseISO(docItem.created_at), "dd/MM/yyyy HH:mm")}`, 14, currentY + 6);
    
    currentY += 14;

    if (docItem.document_type === 'foto' || docItem.document_type === 'assinatura') {
      doc.text(docItem.document_type === 'foto' ? 'Fotografia Anexada:' : 'Assinatura Digital:', 14, currentY);
      currentY += 6;
      
      try {
        // Para adicionar imagem no PDF precisamos baixar ela como blob e transformar em base64
        const img = await fetchImageBase64(docItem.file_url);
        if (img) {
          const width = docItem.document_type === 'foto' ? 100 : 80;
          const height = docItem.document_type === 'foto' ? 75 : 40;
          doc.addImage(img, 'JPEG', 14, currentY, width, height);
          currentY += height + 10;
        }
      } catch (e) {
        doc.setTextColor(255, 0, 0);
        doc.text('(Erro ao carregar imagem para o PDF)', 14, currentY);
        doc.setTextColor(0);
        currentY += 10;
      }
    } else if (docItem.document_type === 'checklist') {
      doc.text(`Documento de Checklist anexado (Não pode ser exibido no PDF, veja o anexo no sistema)`, 14, currentY);
      currentY += 10;
    }

    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.line(14, currentY, 196, currentY);
    currentY += 10;
  }

  doc.save(`Recibo_${materialName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

// Helper para baixar imagem como base64
async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Failed to load image for PDF", e);
    return null;
  }
}
