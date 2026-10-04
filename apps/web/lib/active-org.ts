export async function getActiveOrganizationId(supabase: any): Promise<string> {
  const { data, error } = await supabase.rpc('get_active_organization');
  if (error || !data) throw error ?? new Error('No active organization');
  return String(data);
}
