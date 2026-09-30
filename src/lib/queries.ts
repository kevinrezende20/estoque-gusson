import { supabase } from "./supabase";
import { useQuery } from "@tanstack/react-query";

export type DBHospital = {
  id: string;
  name: string;
  city: string;
  contact: string | null;
  cme_delivery_time: string | null;
  cme_pickup_time: string | null;
  opme_delivery_time: string | null;
  opme_pickup_time: string | null;
  created_at: string;
};

export type DBMaterial = {
  id: string;
  hospital_id: string;
  section: "CME" | "OPME";
  stock_type: "transitorio" | "consignado";
  name: string;
  boxes: number;
  delivery: string | null;
  pickup: string | null;
  status: string;
  is_approved: boolean;
  pending_withdrawal_boxes: number;
  pending_withdrawal_reason?: 'estoque' | 'hospital' | null;
  pending_withdrawal_hospital_id?: string | null;
  pending_withdrawal_comment?: string | null;
  created_by: string | null;
  created_at: string;
};

export type DBGuide = {
  id: string;
  title: string;
  description: string;
  photo_url: string | null;
  created_at: string;
};

export function useHospitals() {
  return useQuery({
    queryKey: ['hospitals'],
    queryFn: async () => {
      const { data, error } = await supabase.from('hospitals').select('*').order('name');
      if (error) throw error;
      return data as DBHospital[];
    }
  });
}

export function useHospital(id: string) {
  return useQuery({
    queryKey: ['hospitals', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('hospitals').select('*').eq('id', id).single();
      if (error) throw error;
      return data as DBHospital;
    }
  });
}

export function useMaterials(hospitalId: string) {
  return useQuery({
    queryKey: ['materials', hospitalId],
    queryFn: async () => {
      const { data, error } = await supabase.from('materials').select('*').eq('hospital_id', hospitalId).order('created_at', { ascending: false });
      if (error) throw error;
      return data as DBMaterial[];
    }
  });
}

export async function logAuditAction(userId: string, hospitalId: string, materialName: string, actionType: string, details: any = {}) {
  try {
    await supabase.from('audit_logs').insert([{
      user_id: userId,
      hospital_id: hospitalId,
      material_name: materialName,
      action_type: actionType,
      details: details
    }]);
  } catch (err) {
    console.error("Falha ao salvar log de auditoria", err);
  }
}

export type DBAuditLog = {
  id: string;
  user_id: string | null;
  hospital_id: string | null;
  material_name: string;
  action_type: string;
  details: Record<string, any>;
  created_at: string;
};

export function useAuditLogs() {
  return useQuery({
    queryKey: ['audit_logs'],
    queryFn: async () => {
      const { data: logsData, error: logsError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (logsError) throw logsError;

      // Buscar emails dos usuários através da view admin_users_view
      const { data: usersData, error: usersError } = await supabase
        .from('admin_users_view')
        .select('id, email, display_name');
        
      if (usersError) throw usersError;

      // Fazer o merge no lado do cliente
      return logsData.map(log => {
        const user = usersData?.find(u => u.id === log.user_id);
        return {
          ...log,
          users: { email: user?.display_name || user?.email || 'Usuário Desconhecido' }
        };
      }) as (DBAuditLog & { users?: { email: string } })[];
    }
  });
}

export function useWithdrawnLogs() {
  return useQuery({
    queryKey: ['withdrawn_logs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('audit_logs')
        .select(`
          *,
          users:user_id (email)
        `)
        .in('action_type', ['Aprovação de Saída', 'Aprovação de Saída (Painel)', 'Retirada Direta'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as (DBAuditLog & { users?: { email: string } })[];
    }
  });
}

export type DBMaterialDocument = {
  id: string;
  material_id: string;
  document_type: 'foto' | 'assinatura' | 'checklist';
  action_context: 'entrega' | 'retirada';
  file_url: string;
  checklist_data: Record<string, boolean>; // can be kept for legacy or empty
  created_by: string | null;
  created_at: string;
};

export async function uploadMaterialDocument(
  materialId: string, 
  userId: string,
  docType: 'foto' | 'assinatura' | 'checklist', 
  context: 'entrega' | 'retirada', 
  file: File | string, 
  checklistData: Record<string, boolean> = {}
) {
  try {
    let filePath = `${materialId}/${context}_${docType}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    let fileBody: any = file;
    let contentType = 'application/octet-stream';
    
    // Se for base64 (assinatura)
    if (typeof file === 'string' && file.startsWith('data:image')) {
      const base64Data = file.replace(/^data:image\/\w+;base64,/, "");
      // Precisa converter de base64 para Buffer/Blob. No browser, convertemos para blob.
      const byteCharacters = atob(base64Data);
      const byteArrays = [];
      for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      fileBody = new Blob(byteArrays, { type: 'image/png' });
      filePath += '.png';
      contentType = 'image/png';
    } else if (file instanceof File) {
      filePath += `_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      contentType = file.type || 'application/octet-stream';
    }

    // Fazer Upload
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('material_attachments')
      .upload(filePath, fileBody, {
        upsert: false,
        contentType: contentType
      });

    if (uploadError) throw uploadError;

    // Pegar URL Pública
    const { data: { publicUrl } } = supabase.storage
      .from('material_attachments')
      .getPublicUrl(filePath);

    // Salvar no BD
    const { error: dbError } = await supabase.from('material_documents').insert([{
      material_id: materialId,
      document_type: docType,
      action_context: context,
      file_url: publicUrl,
      checklist_data: checklistData,
      created_by: userId
    }]);

    if (dbError) throw dbError;
    return true;
  } catch (err) {
    console.error("Erro ao subir documento", err);
    return false;
  }
}

export function useMaterialDocuments(materialId: string | null) {
  return useQuery({
    queryKey: ['material_documents', materialId],
    queryFn: async () => {
      if (!materialId) return [];
      const { data, error } = await supabase.from('material_documents')
        .select('*')
        .eq('material_id', materialId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as DBMaterialDocument[];
    },
    enabled: !!materialId
  });
}


export function useGuides() {
  return useQuery({
    queryKey: ['guides'],
    queryFn: async () => {
      const { data, error } = await supabase.from('procedure_guides').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as DBGuide[];
    }
  });
}

